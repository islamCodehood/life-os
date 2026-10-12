import {timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {getServerEnv} from '@/src/infrastructure/env/server';
import {getDatabase} from '@/src/infrastructure/database/client';
import {Notifications} from '@/src/infrastructure/notifications/notifications';
import {createRequestId} from '@/src/infrastructure/http/request-id';
import {errorResponse} from '@/src/infrastructure/http/route-error';
import {AppError} from '@/src/infrastructure/http/errors';
export const dynamic='force-dynamic';
function matches(header:string|null,secret:string){
 if(!header?.startsWith('Bearer '))return false;
 const one=Buffer.from(header.slice(7)),two=Buffer.from(secret);
 return one.length===two.length&&timingSafeEqual(one,two);
}
export async function POST(request:Request){
 const requestId=createRequestId(request.headers.get('x-request-id'));
 try{
  const secret=getServerEnv().INTERNAL_SCHEDULER_SECRET;
  if(!secret)throw new AppError('INTERNAL_ERROR','Scheduler secret is not configured.');
  if(!matches(request.headers.get('authorization'),secret))
   throw new AppError('FORBIDDEN','Invalid internal scheduler credential.');
  const outbox=await new Notifications(getDatabase().db).work();
  return NextResponse.json({ok:true,outbox},{headers:{'cache-control':'no-store','x-request-id':requestId}});
 }catch(error){return errorResponse(error,requestId);}
}
