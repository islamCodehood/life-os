import {NextResponse} from 'next/server';
import {z} from 'zod';
import {createActivityRuntime} from '@/src/infrastructure/composition/activity-runtime';
import {AppError} from '@/src/infrastructure/http/errors';
import {createRequestId} from '@/src/infrastructure/http/request-id';
import {errorResponse} from '@/src/infrastructure/http/route-error';
import type {ChildId} from '@/src/domain/shared/id';
export async function GET(request:Request,{params}:{params:Promise<{childId:string}>}){
 const requestId=createRequestId(request.headers.get('x-request-id'));
 try{
  const childId=z.string().uuid().parse((await params).childId);
  const runtime=await createActivityRuntime();const actor=await runtime.actorResolver.resolve(request);
  if(!actor)throw new AppError('AUTH_REQUIRED','Authentication required.');
  if(actor.kind!=='GUARDIAN')throw new AppError('FORBIDDEN','Guardian required.');
  const child=await runtime.repository.getChild(actor.familyId,childId as ChildId);
  if(!child)throw new AppError('RESOURCE_NOT_FOUND','Child not found.');
  const jobs=await runtime.jobs.listVisible(actor,childId);
  return NextResponse.json({childId,jobs},{headers:{'x-request-id':requestId,'cache-control':'no-store'}});
 }catch(error){return errorResponse(error,requestId)}
}
