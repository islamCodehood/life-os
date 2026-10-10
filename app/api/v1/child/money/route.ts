import {NextResponse} from 'next/server';
import {createActivityRuntime} from '@/src/infrastructure/composition/activity-runtime';
import {AppError} from '@/src/infrastructure/http/errors';
import {createRequestId} from '@/src/infrastructure/http/request-id';
import {errorResponse} from '@/src/infrastructure/http/route-error';
export async function GET(request:Request){
 const requestId=createRequestId(request.headers.get('x-request-id'));
 try{
  const runtime=await createActivityRuntime();const actor=await runtime.actorResolver.resolve(request);
  if(!actor)throw new AppError('AUTH_REQUIRED','Authentication required.');
  if(actor.kind!=='CHILD')throw new AppError('FORBIDDEN','Child session required.');
  const wallet=await runtime.money.view(actor,actor.childId);
  return NextResponse.json(wallet,{headers:{'x-request-id':requestId,'cache-control':'no-store'}});
 }catch(error){return errorResponse(error,requestId)}
}
