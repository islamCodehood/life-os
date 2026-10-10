import type {ActorContext} from '@/src/application/auth/actor-context';
import type {IdentityRepository} from '@/src/application/identity/identity-repository';
import type {ActivityRepository} from '@/src/application/activity/activity-repository';
import {deriveAgeProfile} from '@/src/domain/identity/experience';
import {currentDateInTimezone} from '@/src/application/identity/current-date';
import type {ChildId,DomainEventId,FamilyId} from '@/src/domain/shared/id';
import {newId} from '@/src/domain/shared/id';
import {canSeeMoment,momentSnapshot,normalizeTags,validateMoment,MomentRuleError,
 type Moment,type MomentPrivacy,type ValueTag,type MomentRevision} from '@/src/domain/moments/moment';
import {composeStory} from '@/src/domain/moments/story-composer';
import type {MomentRepository} from './moment-repository';

export class MomentDomainError extends Error{
 constructor(readonly code:'FORBIDDEN'|'RESOURCE_NOT_FOUND'|'STALE_VERSION'|'DOMAIN_RULE_VIOLATION'|'RESOURCE_STATE_CHANGED',message:string){
  super(message);this.name='MomentDomainError';
 }
}
function guardian(actor:ActorContext):asserts actor is Extract<ActorContext,{kind:'GUARDIAN'}>{
 if(actor.kind!=='GUARDIAN')throw new MomentDomainError('FORBIDDEN','Guardian approval required for published Moments.');
}
type Fields={subjectChildId:string|null;privacy:MomentPrivacy;title:string;description:string;
 tags:ValueTag[];momentOccurredAt:Date};
export class MomentService{
 constructor(
  private readonly repository:MomentRepository,private readonly identity:IdentityRepository,
  private readonly events:Pick<ActivityRepository,'appendDomainEvent'>,
 ){}
 private async familyChild(actor:ActorContext,childId:string){
  if(actor.kind==='SYSTEM'||(actor.kind==='CHILD'&&actor.childId!==childId))
   throw new MomentDomainError('RESOURCE_NOT_FOUND','Child not found.');
  const family=await this.identity.getFamily(actor.familyId);
  const child=await this.identity.getChild(actor.familyId,childId as ChildId);
  if(!family||!child)throw new MomentDomainError('RESOURCE_NOT_FOUND','Child not found.');
  return {family,child};
 }
 private async checkFields(actor:ActorContext,fields:Fields,now:Date){
  const family=await this.identity.getFamily(actor.familyId!);
  if(!family)throw new MomentDomainError('RESOURCE_NOT_FOUND','Family not found.');
  if(fields.subjectChildId!==null)await this.familyChild(actor,fields.subjectChildId);
  try{validateMoment({subjectChildId:fields.subjectChildId,privacy:fields.privacy,
   title:fields.title,description:fields.description,tags:fields.tags,occurredAt:fields.momentOccurredAt,now});
  }catch(error){if(error instanceof MomentRuleError)throw new MomentDomainError('DOMAIN_RULE_VIOLATION',error.message);throw error;}
  return family;
 }
 private async event(moment:Moment,action:'MomentRecorded'|'MomentUpdated'|'MomentArchived',occurredAt:Date,now:Date){
  // Never log raw Moment description, title, privacy or value tags to generic events.
  await this.events.appendDomainEvent({
   id:newId<'DomainEventId'>() as DomainEventId,
   familyId:moment.familyId as FamilyId,type:action,aggregateType:'Moment',aggregateId:moment.id,
   occurredAt,recordedAt:now,payload:{version:moment.version},
  });
 }
 private async revision(moment:Moment,before:Moment|null,
  action:MomentRevision['action'],editedAt:Date,reason:string|null){
  await this.repository.appendRevision({
   id:newId<'MomentRevisionId'>(),familyId:moment.familyId,momentId:moment.id,
   version:moment.version,action,before:before?momentSnapshot(before):null,
   after:momentSnapshot(moment),editedByKind:'GUARDIAN',editedAt,reason,
  });
 }
 async record(actor:ActorContext,fields:Fields&{occurredAt:Date;now:Date}){
  // E9 has no persisted child Moment autonomy grant; conservative published writes only.
  guardian(actor);
  await this.checkFields(actor,fields,fields.now);
  const m:Moment={id:newId<'MomentId'>(),familyId:actor.familyId,
   subjectChildId:fields.subjectChildId,authorKind:'GUARDIAN',authorChildId:null,
   title:fields.title.trim(),description:fields.description.trim(),privacy:fields.privacy,
   tags:normalizeTags(fields.tags),occurredAt:fields.momentOccurredAt,createdAt:fields.now,
   updatedAt:fields.now,status:'PUBLISHED',version:1};
  await this.repository.insert(m);await this.revision(m,null,'RECORDED',fields.now,null);
  await this.event(m,'MomentRecorded',fields.occurredAt,fields.now);
  return {momentId:m.id,status:m.status,version:m.version};
 }
 private async locked(actor:ActorContext,id:string,expectedVersion:number|undefined){
  guardian(actor);
  const m=await this.repository.lock(actor.familyId,id);
  if(!m)throw new MomentDomainError('RESOURCE_NOT_FOUND','Moment not found.');
  if(expectedVersion===undefined||m.version!==expectedVersion)
   throw new MomentDomainError('STALE_VERSION','Moment changed; refresh before editing.');
  if(m.status==='ARCHIVED')throw new MomentDomainError('RESOURCE_STATE_CHANGED','Moment is archived.');
  return m;
 }
 async update(actor:ActorContext,input:Fields&{momentId:string;reason:string;expectedVersion?:number|undefined;occurredAt:Date;now:Date}){
  const m=await this.locked(actor,input.momentId,input.expectedVersion);
  await this.checkFields(actor,input,input.now);
  const next:Moment={...m,subjectChildId:input.subjectChildId,privacy:input.privacy,
   title:input.title.trim(),description:input.description.trim(),
   tags:normalizeTags(input.tags),occurredAt:input.momentOccurredAt,
   updatedAt:input.now,version:m.version+1};
  const updated=await this.repository.update(next,m.version);
  if(!updated)throw new MomentDomainError('STALE_VERSION','Moment changed on another device.');
  await this.revision(updated,m,'UPDATED',input.now,input.reason.trim());
  await this.event(updated,'MomentUpdated',input.occurredAt,input.now);
  return {momentId:updated.id,status:updated.status,version:updated.version};
 }
 async archive(actor:ActorContext,input:{momentId:string;reason:string;expectedVersion?:number|undefined;occurredAt:Date;now:Date}){
  const m=await this.locked(actor,input.momentId,input.expectedVersion);
  const updated=await this.repository.update({...m,status:'ARCHIVED',version:m.version+1,updatedAt:input.now},m.version);
  if(!updated)throw new MomentDomainError('STALE_VERSION','Moment changed on another device.');
  await this.revision(updated,m,'ARCHIVED',input.now,input.reason.trim());
  await this.event(updated,'MomentArchived',input.occurredAt,input.now);
  return {momentId:updated.id,status:updated.status,version:updated.version};
 }
 async listGuardian(actor:ActorContext,childId?:string){
  guardian(actor);
  if(childId)await this.familyChild(actor,childId);
  return this.repository.listForGuardian(actor.familyId,childId);
 }
 async story(actor:ActorContext,childId:string,now=new Date(),visualization?:'IMMERSIVE'|'BALANCED'|'FOCUSED'){
  const {family,child}=await this.familyChild(actor,childId);
  const visible=await this.repository.listForChild(family.id,childId);
  const publicMoments=visible.filter(m=>canSeeMoment(m,childId));
  const profile=deriveAgeProfile(child.birthDate,currentDateInTimezone(family.timezone,now));
  return {
   childId,ageProfile:profile,
   items:composeStory({moments:publicMoments,profile,...(visualization?{visualization}:{})}),
  };
 }
 async guardianHistory(actor:ActorContext,momentId:string){
  guardian(actor);
  const m=await this.repository.lock(actor.familyId,momentId);
  if(!m)throw new MomentDomainError('RESOURCE_NOT_FOUND','Moment not found.');
  return {momentId,revisions:await this.repository.revisions(actor.familyId,momentId)};
 }
}
