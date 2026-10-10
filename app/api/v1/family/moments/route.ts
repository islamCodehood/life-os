import {NextResponse} from 'next/server';
import {createActivityRuntime} from '@/src/infrastructure/composition/activity-runtime';
import {AppError} from '@/src/infrastructure/http/errors';
import {createRequestId} from '@/src/infrastructure/http/request-id';
import {errorResponse} from '@/src/infrastructure/http/route-error';
export async function GET(request:Request){
 const requestId=createRequestId(request.headers.get('x-request-id'));
 try{
  const rt=await createActivityRuntime(),actor=await rt.actorResolver.resolve(request);
  if(!actor)throw new AppError('AUTH_REQUIRED','Authentication is required.');
  if(actor.kind==='SYSTEM')throw new AppError('FORBIDDEN','Family session required.');
  const items=actor.kind==='GUARDIAN'
    ?(await rt.moments.listGuardian(actor)).filter(m=>m.privacy==='FAMILY_SHARED'&&m.status==='PUBLISHED')
    :(await rt.moments.story(actor,actor.childId)).items.filter(m=>m.isFamily);
  return NextResponse.json({items},{headers:{'cache-control':'no-store','x-request-id':requestId}});
 }catch(error){return errorResponse(error,requestId)}
}
