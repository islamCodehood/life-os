import {describe,expect,it} from 'vitest';
import type {ReviewRepository} from '@/src/application/weekly-review/review-repository';
import {ReviewService} from '@/src/application/weekly-review/review-service';
import type {ReviewEntry,ReviewPrompt,ReviewStatus,WeeklyReview,WeeklySummary} from '@/src/domain/weekly-review/review';
import type {ActorContext} from '@/src/application/auth/actor-context';
import {InMemoryIdentityRepository} from '../support/in-memory-identity-repository';
import type {ChildId,FamilyId,GuardianId,DeviceId} from '@/src/domain/shared/id';
const familyId='01900000-0000-7000-8000-000000000611' as FamilyId;
const childA='01900000-0000-7000-8000-000000000612' as ChildId;
const childB='01900000-0000-7000-8000-000000000613' as ChildId;
const guardianId='01900000-0000-7000-8000-000000000614' as GuardianId;
const deviceId='01900000-0000-7000-8000-000000000615' as DeviceId;
const guardian:ActorContext={kind:'GUARDIAN',familyId,guardianId};
const child:ActorContext={kind:'CHILD',familyId,childId:childA,deviceId};
const sibling:ActorContext={kind:'CHILD',familyId,childId:childB,deviceId};
const now=new Date('2026-10-12T18:30:00Z');
class MemoryReview implements ReviewRepository{
 reviews=new Map<string,WeeklyReview>();entriesByKey=new Map<string,ReviewEntry>();
 summaryCalls:Array<{childId:string|null;start:string;end:string}>=[];
 listFamilies(){return Promise.resolve([{id:familyId,timezone:'Africa/Cairo',weeklyReviewDay:5}]);}
 async create(r:WeeklyReview){
  const existing=await this.forWeek(r.familyId,r.weekStart);
  if(existing)return existing;this.reviews.set(r.id,r);return r;
 }
 async get(f:string,id:string){const r=this.reviews.get(id);return r?.familyId===f?r:null;}
 async lock(f:string,id:string){return this.get(f,id);}
 async forWeek(f:string,start:string){return [...this.reviews.values()].find(r=>r.familyId===f&&r.weekStart===start)??null;}
 async entries(f:string,id:string){return [...this.entriesByKey.values()].filter(e=>e.familyId===f&&e.reviewId===id);}
 async entry(f:string,id:string,key:string,prompt:ReviewPrompt){return this.entriesByKey.get(id+':'+key+':'+prompt)?.familyId===f?
   this.entriesByKey.get(id+':'+key+':'+prompt)??null:null;}
 async insertEntry(e:ReviewEntry){
  const key=e.reviewId+':'+e.authorKey+':'+e.prompt;
  if(this.entriesByKey.has(key))return false;this.entriesByKey.set(key,e);return true;
 }
 async updateEntry(e:ReviewEntry,expectedVersion:number){
  const key=e.reviewId+':'+e.authorKey+':'+e.prompt;
  const old=this.entriesByKey.get(key);
  if(!old||old.version!==expectedVersion)return false;this.entriesByKey.set(key,e);return true;
 }
 async transition(f:string,id:string,expected:number,status:ReviewStatus,focus:string|null,at:Date){
  const current=await this.get(f,id);
  if(!current||current.status!=='OPEN'||current.version!==expected)return null;
  const next={...current,status,nextFocus:focus,finishedAt:at,version:expected+1};
  this.reviews.set(id,next);return next;
 }
 async abandonOlder(f:string,before:string,at:Date){
  let count=0;for(const [id,r] of this.reviews)
   if(r.familyId===f&&r.status==='OPEN'&&r.weekStart<before){
    this.reviews.set(id,{...r,status:'ABANDONED',version:r.version+1,finishedAt:at});count++;
   }return count;
 }
 async summary(f:string,start:string,end:string,childId:string|null):Promise<WeeklySummary>{
  this.summaryCalls.push({childId,start,end});
  return {window:{weekStart:start,weekEnd:end},completedResponsibilities:childId?2:4,
   practisedSkills:childId?1:3,achievedGoals:0,personalMoments:childId?1:2,sharedMoments:1};
 }
}
function setup(){
 const identity=new InMemoryIdentityRepository();
 identity.families.set(familyId,{id:familyId,name:'Family',timezone:'Africa/Cairo',currency:'EGP',
  weeklyReviewDay:5,version:1});
 for(const [id,birthDate] of [[childA,'2018-02-01'],[childB,'2015-02-01']] as const){
  identity.children.set(id,{id,familyId,displayName:'Child',birthDate,avatarKey:null,status:'ACTIVE',version:1});
 }
 const repo=new MemoryReview();
 return {repo,service:new ReviewService(repo,identity)};
}
describe('E11 weekly lifecycle and strict privacy',()=>{
 it('starts exactly one review for a family-local week, regardless of repeat requests',async()=>{
  const {repo,service}=setup();
  const a=await service.start(guardian,now),b=await service.start(guardian,now);
  expect(a.id).toBe(b.id);expect(repo.reviews.size).toBe(1);
  expect(a.weekStart).toBe('2026-10-02');expect(a.reviewOn).toBe('2026-10-09');
  await expect(service.start(child,now)).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('only lets children create or edit their own reflections, guardian cannot change their text',async()=>{
  const {service}=setup();
  const r=await service.start(guardian,now);
  const first=await service.saveEntry(child,{reviewId:r.id,prompt:'PROUD',text:'I tried a new book',
   expectedEntryVersion:0,now});
  expect(first.version).toBe(1);
  await expect(service.saveEntry(child,{reviewId:r.id,prompt:'PROUD',text:'Wrong overwrite',
   expectedEntryVersion:0,now})).rejects.toMatchObject({code:'STALE_VERSION'});
  const guardianEntry=await service.saveEntry(guardian,{reviewId:r.id,prompt:'PROUD',
   text:'We had a kind conversation',expectedEntryVersion:0,now});
  expect(guardianEntry.entryId).not.toBe(first.entryId);
  await service.saveEntry(sibling,{reviewId:r.id,prompt:'PROUD',
   text:'I enjoyed reading',expectedEntryVersion:0,now});
  const childView=await service.current(child,now);
  expect(childView.entries).toHaveLength(1);
  expect(JSON.stringify(childView)).not.toContain('We had a kind conversation');
  expect(JSON.stringify(childView)).not.toContain('I enjoyed reading');
  expect(childView.summary?.completedResponsibilities).toBe(2);
  expect(childView.presentation).toBe('ILLUSTRATED');
  expect((await service.current(guardian,now)).entries).toHaveLength(3);
 });
 it('completes with explicit focus and freezes writes; no automatic penalty or XP',async()=>{
  const {repo,service}=setup();
  const r=await service.start(guardian,now);
  await expect(service.complete(child,{reviewId:r.id,expectedReviewVersion:1,nextFocus:'Read together',now}))
   .rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(service.complete(guardian,{reviewId:r.id,expectedReviewVersion:1,nextFocus:'no',now}))
   .rejects.toMatchObject({code:'DOMAIN_RULE_VIOLATION'});
  const done=await service.complete(guardian,{reviewId:r.id,expectedReviewVersion:1,
   nextFocus:'Read together next week',now});
  expect(done).toMatchObject({status:'COMPLETED',version:2});
  await expect(service.saveEntry(child,{reviewId:r.id,prompt:'DIFFICULT',text:'Busy',
   expectedEntryVersion:0,now})).rejects.toMatchObject({code:'RESOURCE_STATE_CHANGED'});
  await expect(service.skip(guardian,{reviewId:r.id,expectedReviewVersion:1,now}))
   .rejects.toMatchObject({code:'STALE_VERSION'});
  expect((await repo.get(familyId,r.id))?.nextFocus).toBe('Read together next week');
 });
 it('skips and abandons without deleting entries, changing child facts or creating penalties',async()=>{
  const {repo,service}=setup();
  const r=await service.start(guardian,now);
  await service.saveEntry(child,{reviewId:r.id,prompt:'LEARNED',text:'I learned',
   expectedEntryVersion:0,now});
  await service.skip(guardian,{reviewId:r.id,expectedReviewVersion:1,now});
  expect((await repo.entries(familyId,r.id))).toHaveLength(1);
  expect((await service.current(guardian,now)).review?.status).toBe('SKIPPED');
  const nextWeek=new Date('2026-10-16T18:30:00Z');
  const next=await service.start(guardian,nextWeek);
  expect(next.id).not.toBe(r.id);expect((await repo.get(familyId,r.id))?.status).toBe('SKIPPED');
  const following=new Date('2026-10-23T18:30:00Z');
  await service.scheduleAll(following);
  expect((await repo.get(familyId,next.id))?.status).toBe('ABANDONED');
  expect((await repo.entries(familyId,r.id))).toHaveLength(1);
  expect(repo.reviews.size).toBe(3);
 });
 it('repeated scheduler invocations never reset an open or completed review',async()=>{
  const {repo,service}=setup();
  expect((await service.scheduleAll(now)).created).toBe(1);
  expect((await service.scheduleAll(now)).created).toBe(0);
  const review=[...repo.reviews.values()][0]!;
  await service.complete(guardian,{reviewId:review.id,expectedReviewVersion:1,
   nextFocus:'Spend more time together',now});
  await service.scheduleAll(now);
  expect((await repo.get(familyId,review.id))?.status).toBe('COMPLETED');
 });
});
