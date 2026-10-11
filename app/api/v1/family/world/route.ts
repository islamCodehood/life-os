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
  if(actor.kind==='SYSTEM')throw new AppError('FORBIDDEN','Family actor required.');
  const world=await runtime.world.read(actor,'FAMILY',null);
  return NextResponse.json(world,{headers:{'cache-control':'no-store','x-request-id':requestId}});
 }catch(error){return errorResponse(error,requestId);}
}
