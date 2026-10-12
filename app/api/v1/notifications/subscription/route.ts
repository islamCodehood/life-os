import {NextResponse} from 'next/server';
import {z} from 'zod';
import {createActivityRuntime} from '@/src/infrastructure/composition/activity-runtime';
import {getDatabase} from '@/src/infrastructure/database/client';
import {Notifications} from '@/src/infrastructure/notifications/notifications';
import {AppError} from '@/src/infrastructure/http/errors';
import {errorResponse} from '@/src/infrastructure/http/route-error';
import {createRequestId} from '@/src/infrastructure/http/request-id';
const subscription=z.object({endpoint:z.string().url().max(2048),
 keys:z.object({p256dh:z.string().min(12).max(300),auth:z.string().min(8).max(300)}).strict()}).strict();
async function scope(request:Request){
 const origin=request.headers.get('origin');
 if(!origin||origin!==new URL(request.url).origin)throw new AppError('FORBIDDEN','Same-origin request required.');
 const rt=await createActivityRuntime(),actor=await rt.actorResolver.resolve(request);
 if(!actor||actor.kind==='SYSTEM')throw new AppError('AUTH_REQUIRED','Family session required.');
 return actor;
}
export async function POST(request:Request){
 const requestId=createRequestId(request.headers.get('x-request-id'));
 try{
  const actor=await scope(request);
  const result=await new Notifications(getDatabase().db).subscribe(actor,subscription.parse(await request.json()));
  return NextResponse.json(result,{headers:{'cache-control':'no-store','x-request-id':requestId}});
 }catch(e){return errorResponse(e,requestId)}
}
export async function DELETE(request:Request){
 const requestId=createRequestId(request.headers.get('x-request-id'));
 try{
  const actor=await scope(request);
  const {endpoint}=z.object({endpoint:z.string().url().max(2048)}).strict().parse(await request.json());
  const result=await new Notifications(getDatabase().db).unsubscribe(actor,endpoint);
  return NextResponse.json(result,{headers:{'cache-control':'no-store','x-request-id':requestId}});
 }catch(e){return errorResponse(e,requestId)}
}
