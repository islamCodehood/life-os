import {timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {sql} from 'drizzle-orm';
import {getDatabase} from '@/src/infrastructure/database/client';
import {getServerEnv} from '@/src/infrastructure/env/server';
import {AppError} from '@/src/infrastructure/http/errors';
import {errorResponse} from '@/src/infrastructure/http/route-error';
import {createRequestId} from '@/src/infrastructure/http/request-id';
export const dynamic='force-dynamic';
function authorized(header:string|null,secret:string):boolean{
 if(!header?.startsWith('Bearer '))return false;
 const one=Buffer.from(header.slice(7)),two=Buffer.from(secret);
 return one.length===two.length&&timingSafeEqual(one,two);
}
export async function GET(request:Request){
 const requestId=createRequestId(request.headers.get('x-request-id'));
 try{
  const secret=getServerEnv().INTERNAL_SCHEDULER_SECRET;
  if(!secret)throw new AppError('INTERNAL_ERROR','Internal operations secret is missing.');
  if(!authorized(request.headers.get('authorization'),secret))
   throw new AppError('FORBIDDEN','Internal access required.');
  const db=getDatabase().db;
  const [{rows:database},{rows:outbox},{rows:scheduler},{rows:tables}]=await Promise.all([
   db.execute(sql`SELECT 1 AS ok`),
   db.execute(sql`SELECT
    count(*) FILTER(WHERE status='PENDING')::int pending,
    count(*) FILTER(WHERE status='FAILED')::int failed,
    count(*) FILTER(WHERE status='PROCESSING')::int processing,
    COALESCE(EXTRACT(EPOCH FROM (now()-min(created_at)
      FILTER(WHERE status IN ('PENDING','FAILED','PROCESSING')))),0)::int oldest_seconds
    FROM life_os.outbox_messages`),
   db.execute(sql`SELECT max(finished_at) AS last_success FROM life_os.scheduler_runs
    WHERE status='COMPLETED'`),
   db.execute(sql`SELECT count(*)::int AS count FROM information_schema.tables
    WHERE table_schema='life_os'`),
  ]);
  const dbOk=database.length===1,queue=outbox[0] as Record<string,unknown>,
   last=(scheduler[0] as Record<string,unknown>)?.last_success;
  const migrationTables=Number((tables[0] as Record<string,unknown>)?.count??0);
  return NextResponse.json({
   ok:dbOk&&migrationTables>=15,
   database:dbOk?'connected':'unavailable',schemaTables:migrationTables,
   schedulerLastSuccess:last?new Date(last as string).toISOString():null,
   outbox:{pending:Number(queue.pending??0),failed:Number(queue.failed??0),
    processing:Number(queue.processing??0),oldestAgeSeconds:Number(queue.oldest_seconds??0)},
  },{headers:{'cache-control':'no-store','x-request-id':requestId}});
 }catch(error){return errorResponse(error,requestId);}
}
