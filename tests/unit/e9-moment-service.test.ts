import {describe,it,expect} from 'vitest';
import type {Moment,MomentRevision} from '@/src/domain/moments/moment';
import type {MomentRepository} from '@/src/application/moments/moment-repository';
import type {ActivityRepository} from '@/src/application/activity/activity-repository';
import type {ActorContext} from '@/src/application/auth/actor-context';
import type {ChildId,FamilyId,GuardianId,DeviceId} from '@/src/domain/shared/id';
import {MomentService} from '@/src/application/moments/moment-service';
import {InMemoryIdentityRepository} from '../support/in-memory-identity-repository';
const familyId='01900000-0000-7000-8000-000000000411' as FamilyId;
const childId='01900000-0000-7000-8000-000000000412' as ChildId;
const siblingId='01900000-0000-7000-8000-000000000413' as ChildId;
const guardianId='01900000-0000-7000-8000-000000000414' as GuardianId;
const deviceId='01900000-0000-7000-8000-000000000415' as DeviceId;
const guardian:ActorContext={kind:'GUARDIAN',familyId,guardianId};
const child:ActorContext={kind:'CHILD',familyId,childId,deviceId};
const sibling:ActorContext={kind:'CHILD',familyId,childId:siblingId,deviceId};
const now=new Date('2026-10-10T19:00:00Z');
class MemoryMoments implements MomentRepository {
 moments=new Map<string,Moment>();audit:MomentRevision[]=[];
 async insert(m:Moment){this.moments.set(m.id,{...m})}
 async lock(family:string,id:string){const m=this.moments.get(id);return m?.familyId===family?m:null}
 async listForChild(family:string,childId:string){
  return [...this.moments.values()].filter(m=>m.familyId===family&&m.status==='PUBLISHED'&&(
   m.privacy==='FAMILY_SHARED'||(m.privacy==='CHILD_SAFE'&&m.subjectChildId===childId)));
 }
 async listForGuardian(family:string,childId?:string){
  return [...this.moments.values()].filter(m=>m.familyId===family&&(!childId||m.subjectChildId===childId));
 }
 async update(m:Moment,version:number){const stored=await this.lock(m.familyId,m.id);
  if(!stored||stored.version!==version||stored.status!=='PUBLISHED')return null;
  this.moments.set(m.id,{...m});return m;
 }
 async appendRevision(r:MomentRevision){this.audit.push(r)}
 async revisions(family:string,id:string){return this.audit.filter(x=>x.familyId===family&&x.momentId===id)}
}
function setup(){
 const identity=new InMemoryIdentityRepository();
 identity.families.set(familyId,{id:familyId,name:'Family',timezone:'Africa/Cairo',currency:'EGP',weeklyReviewDay:null,version:1});
 for(const id of [childId,siblingId])identity.children.set(id,{
  id,familyId,displayName:'Child',birthDate:id===childId?'2018-02-01':'2015-02-01',
  avatarKey:null,status:'ACTIVE',version:1,
 });
 const records=new MemoryMoments(),events:Array<{type:string;payload:unknown}>=[];
 const activity={appendDomainEvent:async(r:{type:string;payload:unknown})=>{events.push({type:r.type,payload:r.payload})}} as unknown as ActivityRepository;
 return {service:new MomentService(records,identity,activity),records,events};
}
const fields={subjectChildId:childId,privacy:'CHILD_SAFE' as const,
 title:'First kindness',description:'Helped at home with books',
 tags:['KINDNESS'] as const,momentOccurredAt:new Date('2026-10-09T10:00:00Z'),occurredAt:now,now};
describe('E9 Moment lifecycle',()=>{
 it('child cannot self-publish before persisted autonomy; all published edits are guardian reviewed',async()=>{
  const {service,records}=setup();
  await expect(service.record(child,{...fields,tags:[...fields.tags]})).rejects.toMatchObject({code:'FORBIDDEN'});
  const saved=await service.record(guardian,{...fields,tags:[...fields.tags]});
  expect(saved.version).toBe(1);expect(records.audit.map(x=>x.action)).toEqual(['RECORDED']);
  await expect(service.update(child,{...fields,tags:[...fields.tags],momentId:saved.momentId,reason:'Correction',expectedVersion:1}))
   .rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('private sibling and guardian-only data never enter child story, family Moments are shared',async()=>{
  const f=setup();
  await f.service.record(guardian,{...fields,tags:[...fields.tags]});
  await f.service.record(guardian,{...fields,subjectChildId:siblingId,title:'Sibling private',tags:['COURAGE']});
  await f.service.record(guardian,{...fields,privacy:'GUARDIAN_PRIVATE',title:'Parent note',tags:[]});
  const shared=await f.service.record(guardian,{
   ...fields,subjectChildId:null,privacy:'FAMILY_SHARED',title:'Family charity',tags:['FAMILY'],
  });
  const forChild=await f.service.story(child,childId,now,'IMMERSIVE');
  expect(forChild.items.map(m=>m.title)).toEqual(['First kindness','Family charity']);
  expect(forChild.items.every(m=>m.title!=='Sibling private'&&m.title!=='Parent note')).toBe(true);
  expect(forChild.items[0]?.presentation).toBe('ILLUSTRATED');
  const forSibling=await f.service.story(sibling,siblingId,now,'BALANCED');
  expect(forSibling.items.map(m=>m.title)).toEqual(['Sibling private','Family charity']);
  expect(forSibling.items[0]?.presentation).toBe('CARD');
  expect(shared.status).toBe('PUBLISHED');
 });
 it('corrects by creating preserved before/after snapshots; archive excludes child but stays auditable',async()=>{
  const f=setup();
  const first=await f.service.record(guardian,{...fields,tags:['PATIENCE']});
  await expect(f.service.update(guardian,{...fields,tags:['COURAGE'],
   momentId:first.momentId,reason:'Wrong version',expectedVersion:3,title:'Corrected'}))
   .rejects.toMatchObject({code:'STALE_VERSION'});
  const fixed=await f.service.update(guardian,{...fields,tags:['COURAGE'],
   momentId:first.momentId,reason:'Correct factual detail',expectedVersion:1,title:'Corrected'});
  expect(fixed.version).toBe(2);
  const archived=await f.service.archive(guardian,{momentId:first.momentId,reason:'Privacy reconsidered',
   expectedVersion:2,occurredAt:now,now});
  expect(archived.status).toBe('ARCHIVED');
  expect((await f.service.story(child,childId)).items).toHaveLength(0);
  const audit=await f.service.guardianHistory(guardian,first.momentId);
  expect(audit.revisions.map(x=>x.action)).toEqual(['RECORDED','UPDATED','ARCHIVED']);
  expect(audit.revisions[1]?.before?.title).toBe('First kindness');
  expect(audit.revisions[1]?.after.title).toBe('Corrected');
  expect(audit.revisions[2]?.after.status).toBe('ARCHIVED');
  await expect(f.service.archive(guardian,{momentId:first.momentId,reason:'Repeat',
   expectedVersion:3,occurredAt:now,now})).rejects.toMatchObject({code:'RESOURCE_STATE_CHANGED'});
  await expect(f.service.guardianHistory(child,first.momentId)).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(f.events.map(e=>e.type)).toEqual(['MomentRecorded','MomentUpdated','MomentArchived']);
  expect(JSON.stringify(f.events)).not.toContain('First kindness');
 });
});
