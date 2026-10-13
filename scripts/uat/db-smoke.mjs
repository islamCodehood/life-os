// Real PostgreSQL smoke for a clean, disposable CI database only.
// Exercises the actual Drizzle migrations, tenant ownership, review freezes and outbox deduplication.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const url = process.env.DATABASE_URL_RUNTIME;
if (!url || process.env.LIFE_OS_DB_SMOKE_CONFIRM !== 'DISPOSABLE_DATABASE')
  throw new Error('E13 DB smoke requires a disposable URL and LIFE_OS_DB_SMOKE_CONFIRM.');
const client = new pg.Client({ connectionString: url, statement_timeout: 12000 });
await client.connect();
const id = () => randomUUID();
const family = id(),
  another = id(),
  child = id(),
  review = id(),
  reviewOther = id(),
  entry = id(),
  intent = id(),
  outbox = id();
try {
  await client.query('BEGIN');
  const tables = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='life_os'`);
  for (const required of [
    'families',
    'child_profiles',
    'money_transactions',
    'money_postings',
    'processed_commands',
    'domain_events',
    'moments',
    'moment_revisions',
    'world_unlocks',
    'weekly_reviews',
    'weekly_review_entries',
    'notification_intents',
    'outbox_messages',
    'scheduler_runs',
    'push_subscriptions',
  ]) {
    assert(
      tables.rows.some((x) => x.tablename === required),
      'Missing migrated table ' + required,
    );
  }
  await client.query(
    `INSERT INTO life_os.families(id,name,timezone,currency) VALUES
 ($1,'E13 Pilot','Africa/Cairo','EGP'),($2,'Another Family','Africa/Cairo','EGP')`,
    [family, another],
  );
  await client.query(
    `INSERT INTO life_os.child_profiles(id,family_id,display_name,birth_date)
 VALUES ($1,$2,'Pilot child','2018-01-01')`,
    [child, family],
  );
  await client.query(
    `INSERT INTO life_os.weekly_reviews
 (id,family_id,week_start,week_end,review_on,timezone,status)
 VALUES ($1,$2,'2026-10-02','2026-10-09','2026-10-09','Africa/Cairo','OPEN')`,
    [review, family],
  );
  await assert.rejects(
    () =>
      client.query(
        `INSERT INTO life_os.weekly_reviews
 (id,family_id,week_start,week_end,review_on,timezone,status)
 VALUES ($1,$2,'2026-10-02','2026-10-09','2026-10-09','Africa/Cairo','OPEN')`,
        [id(), family],
      ),
    /duplicate key/i,
  );
  // Release the failed statement using a savepoint for subsequent checks.
  // Re-create a clean transaction because PostgreSQL aborts after expected constraint failures.
  await client.query('ROLLBACK');
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO life_os.families(id,name,timezone,currency) VALUES
 ($1,'Pilot','Africa/Cairo','EGP'),($2,'Another Family','Africa/Cairo','EGP')`,
    [family, another],
  );
  await client.query(
    `INSERT INTO life_os.child_profiles(id,family_id,display_name,birth_date)
 VALUES ($1,$2,'Child','2018-01-01')`,
    [child, family],
  );
  await client.query(
    `INSERT INTO life_os.weekly_reviews
 (id,family_id,week_start,week_end,review_on,timezone,status)
 VALUES ($1,$2,'2026-10-02','2026-10-09','2026-10-09','Africa/Cairo','OPEN')`,
    [review, family],
  );
  await client.query(
    `INSERT INTO life_os.weekly_reviews
 (id,family_id,week_start,week_end,review_on,timezone,status)
 VALUES ($1,$2,'2026-10-02','2026-10-09','2026-10-09','Africa/Cairo','OPEN')`,
    [reviewOther, another],
  );
  // Actor-scoped DB FK rejects an entry falsely claiming this child belongs to another family.
  await client.query('SAVEPOINT tenant');
  await assert.rejects(
    () =>
      client.query(
        `INSERT INTO life_os.weekly_review_entries
 (id,family_id,review_id,author_key,author_kind,author_child_id,prompt,response_text)
 VALUES ($1,$2,$3,$4,'CHILD',$5,'PROUD','I helped')`,
        [entry, another, reviewOther, 'CHILD:' + child, child],
      ),
    /foreign key/i,
  );
  await client.query('ROLLBACK TO SAVEPOINT tenant');
  await client.query(
    `INSERT INTO life_os.weekly_review_entries
 (id,family_id,review_id,author_key,author_kind,author_child_id,prompt,response_text)
 VALUES ($1,$2,$3,$4,'CHILD',$5,'PROUD','I helped')`,
    [entry, family, review, 'CHILD:' + child, child],
  );
  await client.query(
    `UPDATE life_os.weekly_reviews SET status='SKIPPED',finished_at=now()
 WHERE id=$1`,
    [review],
  );
  await client.query('SAVEPOINT closed');
  await assert.rejects(
    () =>
      client.query(
        `UPDATE life_os.weekly_review_entries
 SET response_text='forced revision' WHERE id=$1`,
        [entry],
      ),
    /Weekly review is closed/i,
  );
  await client.query('ROLLBACK TO SAVEPOINT closed');
  await client.query(
    `INSERT INTO life_os.notification_intents
 (id,family_id,actor_key,kind,source_key,target_path,due_at)
 VALUES ($1,$2,$3,'ACTIVITY_REMINDER','reminder:test','/en/child',now())`,
    [intent, family, 'CHILD:' + child],
  );
  await client.query(
    `INSERT INTO life_os.outbox_messages
 (id,family_id,intent_id,available_at) VALUES($1,$2,$3,now())`,
    [outbox, family, intent],
  );
  const outboxCount = await client.query(
    `SELECT count(*)::int AS count
 FROM life_os.outbox_messages WHERE intent_id=$1`,
    [intent],
  );
  assert.equal(outboxCount.rows[0].count, 1);
  // Commit the fixture first: the second connection must SEE a job before testing a row lock.
  await client.query('COMMIT');
  const conn2 = new pg.Client({ connectionString: url });
  await conn2.connect();
  try {
    // A second worker must skip the locked job instead of sending it twice.
    await client.query('BEGIN');
    await client.query(`SELECT id FROM life_os.outbox_messages WHERE id=$1 FOR UPDATE`, [outbox]);
    await conn2.query('BEGIN');
    const visible=await conn2.query('SELECT id FROM life_os.outbox_messages WHERE id=$1',[outbox]);
    assert.equal(visible.rows.length,1);
    const skipped = await conn2.query(
      `SELECT id FROM life_os.outbox_messages
   WHERE id=$1 FOR UPDATE SKIP LOCKED`,
      [outbox],
    );
    assert.equal(skipped.rows.length, 0);
    await conn2.query('ROLLBACK');
  } finally {
    await conn2.end();
  }
  await client.query('ROLLBACK');
  // The disposable postgres container is destroyed by CI; no destructive cleanup is needed.
  process.stdout.write(
    'E13 disposable Postgres migration / family isolation / queue-lock smoke passed\n',
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end();
}
