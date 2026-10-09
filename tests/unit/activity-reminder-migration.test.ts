import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('E4 activity reminder migration', () => {
  it('creates reminder records with explicit delivery lifecycle timestamps', () => {
    const migration = fs.readFileSync('drizzle/0007_activity_reminders.sql', 'utf8');

    expect(migration).toContain('"reminder_records"');
    expect(migration).toContain('"source" text NOT NULL');
    expect(migration).toContain('"kind" text NOT NULL');
    expect(migration).toContain('"scheduled_for" timestamp with time zone NOT NULL');
    expect(migration).toContain('"attempted_at" timestamp with time zone');
    expect(migration).toContain('"delivered_at" timestamp with time zone');
    expect(migration).toContain('"acknowledged_at" timestamp with time zone');
    expect(migration).not.toContain('"attempted_at" timestamp with time zone NOT NULL');
    expect(migration).not.toContain('"delivered_at" timestamp with time zone NOT NULL');
    expect(migration).not.toContain('"acknowledged_at" timestamp with time zone NOT NULL');
  });

  it('family-scopes reminders and makes scheduling idempotent', () => {
    const migration = fs.readFileSync('drizzle/0007_activity_reminders.sql', 'utf8');

    expect(migration).toContain('"reminder_instance_family_fk"');
    expect(migration).toContain('"activity_instance_id","family_id"');
    expect(migration).toContain('"reminder_records_schedule_uidx"');
    expect(migration).toContain('"activity_instance_id","source","kind","scheduled_for"');
  });
});
