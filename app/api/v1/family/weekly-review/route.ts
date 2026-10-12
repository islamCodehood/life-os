import {NextResponse} from 'next/server';
import {createActivityRuntime} from '@/src/infrastructure/composition/activity-runtime';
import {reviewToDto} from '@/src/application/weekly-review/review-dto';
import {AppError} from '@/src/infrastructure/http/errors';
import {createRequestId} from '@/src/infrastructure/http/request-id';
import {errorResponse} from '@/src/infrastructure/http/route-error';
export async function GET(request:Request){
 const requestId=createRequestId(request.headers.get('x-request-id'));
 try{
  const rt=await createActivityRuntime();
  const actor=await rt.actorResolver.resolve(request);
  if(!actor)throw new AppError('AUTH_REQUIRED','Authentication required.');
  if(actor.kind==='SYSTEM')throw new AppError('FORBIDDEN','Family actor required.');
  const view=reviewToDto(await rt.reviews.current(actor));
  return NextResponse.json(view,{headers:{'x-request-id':requestId,'cache-control':'private, no-store'}});
 }catch(error){return errorResponse(error,requestId)}
}
