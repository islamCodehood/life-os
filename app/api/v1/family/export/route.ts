import {NextResponse} from 'next/server';
import {eq} from 'drizzle-orm';
import {createActivityRuntime} from '@/src/infrastructure/composition/activity-runtime';
import {getDatabase} from '@/src/infrastructure/database/client';
import * as s from '@/src/infrastructure/database/schema';
import {AppError} from '@/src/infrastructure/http/errors';
import {errorResponse} from '@/src/infrastructure/http/route-error';
import {createRequestId} from '@/src/infrastructure/http/request-id';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const requestId=createRequestId(request.headers.get('x-request-id'));
 try{
  const rt=await createActivityRuntime(),actor=await rt.actorResolver.resolve(request);
  if(!actor)throw new AppError('AUTH_REQUIRED','Guardian authentication required.');
  if(actor.kind!=='GUARDIAN')throw new AppError('FORBIDDEN','Only a guardian may export family information.');
  const db=getDatabase().db,familyId=actor.familyId;
  const family=await rt.repository.getFamily(familyId);
  if(!family)throw new AppError('RESOURCE_NOT_FOUND','Family not found.');
  // Explicit allowlist: never include PIN hashes, child tokens, push endpoints/auth secrets,
  // other families' records or infrastructure credentials.
  const data=await Promise.all([
   db.select({id:s.childProfiles.id,displayName:s.childProfiles.displayName,birthDate:s.childProfiles.birthDate,
    status:s.childProfiles.status}).from(s.childProfiles).where(eq(s.childProfiles.familyId,familyId)),
   db.select().from(s.activityAssignments).where(eq(s.activityAssignments.familyId,familyId)),
   db.select().from(s.activityInstances).where(eq(s.activityInstances.familyId,familyId)),
   db.select().from(s.completionRecords).where(eq(s.completionRecords.familyId,familyId)),
   db.select().from(s.reminderRecords).where(eq(s.reminderRecords.familyId,familyId)),
   db.select().from(s.xpLedger).where(eq(s.xpLedger.familyId,familyId)),
   db.select().from(s.goals).where(eq(s.goals.familyId,familyId)),
   db.select().from(s.goalProgressEntries).where(eq(s.goalProgressEntries.familyId,familyId)),
   db.select().from(s.jobs).where(eq(s.jobs.familyId,familyId)),
   db.select().from(s.moneyTransactions).where(eq(s.moneyTransactions.familyId,familyId)),
   db.select().from(s.moneyPostings).where(eq(s.moneyPostings.familyId,familyId)),
   db.select().from(s.moments).where(eq(s.moments.familyId,familyId)),
   db.select().from(s.momentTags).where(eq(s.momentTags.familyId,familyId)),
   db.select().from(s.momentRevisions).where(eq(s.momentRevisions.familyId,familyId)),
   db.select().from(s.weeklyReviews).where(eq(s.weeklyReviews.familyId,familyId)),
   db.select().from(s.weeklyReviewEntries).where(eq(s.weeklyReviewEntries.familyId,familyId)),
   db.select().from(s.worldUnlocks).where(eq(s.worldUnlocks.familyId,familyId)),
  ]);
  const keys=['children','assignments','activityInstances','completions','reminders',
   'xpLedger','goals','goalProgress','jobs','moneyTransactions','moneyPostings',
   'moments','momentTags','momentRevisions','weeklyReviews','weeklyReviewEntries','worldUnlocks'];
  const sections=Object.fromEntries(keys.map((key,i)=>[key,data[i]]));
  const body=JSON.stringify({
   format:'life-os-family-pilot-export-v1',exportedAt:new Date().toISOString(),
   family:{id:family.id,name:family.name,timezone:family.timezone,currency:family.currency},
   sections,
   notice:'Keep this file private. It contains children’s reflections and family money history.',
  },(_key,value)=>typeof value==='bigint'?value.toString():value);
  return new NextResponse(body,{
   headers:{'content-type':'application/json; charset=utf-8',
    'content-disposition':'attachment; filename="life-os-family-export.json"',
    'cache-control':'private, no-store, max-age=0','x-request-id':requestId,
    'x-content-type-options':'nosniff'},
  });
 }catch(error){return errorResponse(error,requestId);}
}
