import {and,eq,inArray} from 'drizzle-orm';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import {newId} from '@/src/domain/shared/id';
import type {WorldFact,WorldScope,MilestoneKey,SemanticDimension} from '@/src/domain/visual-world/world';
import type {WorldRepository} from '@/src/application/visual-world/world-repository';
import * as s from '@/src/infrastructure/database/schema';
type Db=NodePgDatabase<typeof s>;
type Event={id:string;familyId:string;occurredAt:Date;recordedAt:Date};
function fact(event:Event,scope:WorldScope,childId:string|null,
 milestoneKey:MilestoneKey,dimension:SemanticDimension):WorldFact{
 return {sourceEventId:event.id,familyId:event.familyId,childId,scope,milestoneKey,dimension,
  occurredAt:event.occurredAt,recordedAt:event.recordedAt};
}
export class PostgresWorldRepository implements WorldRepository {
 constructor(private readonly db:Db){}
 async sourceFacts(familyId:string):Promise<WorldFact[]>{
  const facts:WorldFact[]=[];
  const activities=await this.db.select({
   event:s.domainEvents,childId:s.activityInstances.childId,
   category:s.activityDefinitions.category,selfInitiated:s.completionRecords.selfInitiated,
   grantId:s.xpLedger.id,
  }).from(s.domainEvents)
   .innerJoin(s.activityInstances,and(eq(s.domainEvents.aggregateId,s.activityInstances.id),
    eq(s.domainEvents.familyId,s.activityInstances.familyId)))
   .innerJoin(s.activityAssignments,and(eq(s.activityInstances.assignmentId,s.activityAssignments.id),
    eq(s.activityInstances.familyId,s.activityAssignments.familyId)))
   .innerJoin(s.activityDefinitions,and(eq(s.activityAssignments.activityDefinitionId,s.activityDefinitions.id),
    eq(s.activityAssignments.familyId,s.activityDefinitions.familyId)))
   .innerJoin(s.completionRecords,and(eq(s.completionRecords.activityInstanceId,s.activityInstances.id),
    eq(s.completionRecords.familyId,s.activityInstances.familyId)))
   .leftJoin(s.xpLedger,and(eq(s.xpLedger.sourceEventId,s.domainEvents.id),
    eq(s.xpLedger.familyId,s.domainEvents.familyId),eq(s.xpLedger.entryType,'GRANT')))
   .where(and(eq(s.domainEvents.familyId,familyId),eq(s.domainEvents.type,'ActivityCompleted')));
  const correctedGrants=await this.db.select({correctionOf:s.xpLedger.correctionOf})
   .from(s.xpLedger).where(and(eq(s.xpLedger.familyId,familyId),eq(s.xpLedger.entryType,'CORRECTION')));
  const corrected=new Set(correctedGrants.map(v=>v.correctionOf).filter((v):v is string=>v!==null));
  for(const a of activities){
   if(a.category==='SELF_RESPONSIBILITY'&&a.selfInitiated)
    facts.push(fact(a.event,'PERSONAL',a.childId,'HOME_PATH','INDEPENDENCE'));
   if(a.category==='GROWTH'&&a.grantId&&!corrected.has(a.grantId))
    facts.push(fact(a.event,'PERSONAL',a.childId,'LIBRARY_OPEN','LEARNING'));
   if(a.category==='FAMILY_RESPONSIBILITY')
    facts.push(fact(a.event,'FAMILY',null,'FAMILY_TREE','FAMILY'));
  }
  const graduation=await this.db.select({
   event:s.domainEvents,childId:s.graduationRecords.childId,
  }).from(s.domainEvents)
   .innerJoin(s.graduationRecords,and(eq(s.domainEvents.aggregateId,s.graduationRecords.assignmentId),
    eq(s.domainEvents.familyId,s.graduationRecords.familyId),
    eq(s.graduationRecords.status,'GRADUATED')))
   .where(and(eq(s.domainEvents.familyId,familyId),eq(s.domainEvents.type,'ResponsibilityGraduated')));
  for(const a of graduation)facts.push(fact(a.event,'PERSONAL',a.childId,'BRIDGE_READY','AUTONOMY'));
  const goals=await this.db.select({event:s.domainEvents,ownerType:s.goals.ownerType,
   ownerChildId:s.goals.ownerChildId,payload:s.domainEvents.payload})
   .from(s.domainEvents).innerJoin(s.goals,and(
    eq(s.domainEvents.aggregateId,s.goals.id),eq(s.domainEvents.familyId,s.goals.familyId),
    eq(s.goals.status,'ACHIEVED')))
   .where(and(eq(s.domainEvents.familyId,familyId),eq(s.domainEvents.type,'GoalStatusChanged')));
  for(const g of goals){
   const payload=g.payload as {to?:unknown}|null;
   if(payload?.to!=='ACHIEVED')continue;
   if(g.ownerType==='FAMILY')
    facts.push(fact(g.event,'FAMILY',null,'FAMILY_TREE','FAMILY'));
   else if(g.ownerChildId)
    facts.push(fact(g.event,'PERSONAL',g.ownerChildId,'OBSERVATORY_LIT','GOALS'));
  }
  const moments=await this.db.select({event:s.domainEvents,subjectChildId:s.moments.subjectChildId,
   privacy:s.moments.privacy,momentId:s.moments.id,momentVersion:s.moments.version})
   .from(s.domainEvents).innerJoin(s.moments,and(
    eq(s.domainEvents.aggregateId,s.moments.id),eq(s.domainEvents.familyId,s.moments.familyId),
    eq(s.moments.status,'PUBLISHED')))
   .where(and(eq(s.domainEvents.familyId,familyId),eq(s.domainEvents.type,'MomentRecorded')));
  const tags=moments.length?await this.db.select({
   momentId:s.momentTags.momentId,momentVersion:s.momentTags.momentVersion,
   tag:s.momentTags.tag,
  }).from(s.momentTags).where(and(eq(s.momentTags.familyId,familyId),
   inArray(s.momentTags.momentId,moments.map(m=>m.momentId)))):[];
  for(const m of moments){
   if(m.privacy==='FAMILY_SHARED'){
    facts.push(fact(m.event,'FAMILY',null,'FAMILY_GARDEN','FAMILY'));
   }else if(m.privacy==='CHILD_SAFE'&&m.subjectChildId){
    const hasKindness=tags.some(t=>t.momentId===m.momentId&&t.momentVersion===m.momentVersion&&
     (t.tag==='KINDNESS'||t.tag==='GENEROSITY'));
    if(hasKindness)facts.push(fact(m.event,'PERSONAL',m.subjectChildId,'GIVING_GARDEN','KINDNESS'));
   }
   // GUARDIAN_PRIVATE and ARCHIVED Moments are never projected.
  }
  return facts;
 }
 async ensureUnlocks(facts:readonly WorldFact[]){
  // Multiple app replicas can race on a first milestone; uniqueness resolves safely.
  // Never update/delete historical unlocks; live reads intersect against current canonical facts.
  for(const f of facts){
   await this.db.insert(s.worldUnlocks).values({
    id:newId<'WorldUnlockId'>(),familyId:f.familyId,childId:f.childId,
    worldScope:f.scope,semanticDimension:f.dimension,milestoneKey:f.milestoneKey,
    sourceEventId:f.sourceEventId,unlockedAt:f.recordedAt,
   }).onConflictDoNothing({target:[s.worldUnlocks.familyId,
    s.worldUnlocks.sourceEventId,s.worldUnlocks.milestoneKey]});
  }
 }
 async listPersisted(familyId:string,scope:WorldScope,childId:string|null){
  const rows=await this.db.select({sourceEventId:s.worldUnlocks.sourceEventId,
   milestoneKey:s.worldUnlocks.milestoneKey})
   .from(s.worldUnlocks).where(and(eq(s.worldUnlocks.familyId,familyId),
    eq(s.worldUnlocks.worldScope,scope),
    ...(childId===null?[]:[eq(s.worldUnlocks.childId,childId)])));
  return rows;
 }
}
