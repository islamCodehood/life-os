import {describe,expect,it} from 'vitest';
import type {ActorContext} from '@/src/application/auth/actor-context';
import type {JobRepository} from '@/src/application/jobs/job-repository';
import type {MoneyRepository,MoneyTx,SavingGoal} from '@/src/application/money/money-repository';
import {JobService} from '@/src/application/jobs/job-service';
import {MoneyService} from '@/src/application/money/money-service';
import {balanced,type MoneyPosting,type AccountBucket} from '@/src/domain/money/ledger';
import type {Job} from '@/src/domain/jobs/job';
import type {ChildId,FamilyId,GuardianId,DeviceId} from '@/src/domain/shared/id';
import {InMemoryIdentityRepository} from '../support/in-memory-identity-repository';

const familyId='01900000-0000-7000-8000-000000000301' as FamilyId;
const childId='01900000-0000-7000-8000-000000000302' as ChildId;
const siblingId='01900000-0000-7000-8000-000000000303' as ChildId;
const guardianId='01900000-0000-7000-8000-000000000304' as GuardianId;
const deviceId='01900000-0000-7000-8000-000000000305' as DeviceId;
const guardian:ActorContext={kind:'GUARDIAN',familyId,guardianId};
const child:ActorContext={kind:'CHILD',familyId,childId,deviceId};
const sibling:ActorContext={kind:'CHILD',familyId,childId:siblingId,deviceId};
const now=new Date('2026-10-10T18:00:00Z');

class MemoryJobs implements JobRepository {
 jobs=new Map<string,Job>();
 revisions:Array<{jobId:string;termsVersion:number;paymentMinor:string}>=[];
 async create(job:Job){this.jobs.set(job.id,job)}
 async lock(family:string,id:string){return this.get(family,id)}
 async get(family:string,id:string){const job=this.jobs.get(id);return job?.familyId===family?job:null}
 async listChild(family:string,child:string){return [...this.jobs.values()].filter(j=>j.familyId===family&&j.childId===child)}
 async listFamily(family:string){return [...this.jobs.values()].filter(j=>j.familyId===family)}
 async update(input:{familyId:string;id:string;expectedVersion:number;
  patch:Partial<Pick<Job,'status'|'criteria'|'paymentMinor'|'termsVersion'|'acceptedTermsVersion'>>;now:Date}){
  const previous=await this.get(input.familyId,input.id);
  if(!previous||previous.version!==input.expectedVersion)return null;
  const updated={...previous,...input.patch,version:previous.version+1,updatedAt:input.now};
  this.jobs.set(updated.id,updated);return updated;
 }
 async recordRevision(input:{jobId:string;termsVersion:number;paymentMinor:string}){
  this.revisions.push(input);
 }
}

class MemoryMoney implements MoneyRepository {
 transactions:Array<{tx:MoneyTx;postings:MoneyPosting[]}>= [];
 savingGoals=new Map<string,SavingGoal>();
 earmarks:Array<{id:string;familyId:string;childId:string;savingGoalId:string;amountMinor:bigint}>=[];
 constructor(private jobs:MemoryJobs){}
 async lockWallet(_familyId:string,_childId:string){}
 async payableJob(family:string,id:string){
  const job=await this.jobs.get(family,id);
  return job?{childId:job.childId,paymentMinor:job.paymentMinor,status:job.status,
   termsVersion:job.termsVersion,acceptedTermsVersion:job.acceptedTermsVersion}:null;
 }
 async ensureAccounts(_familyId:string,_childId:string,_currency:string){
  return {UNALLOCATED:'unallocated',GIVE:'give',SAVE:'save',SPEND:'spend',EXTERNAL:'external'};
 }
 async balances(family:string,child:string){
  const items=this.transactions.filter(r=>r.tx.familyId===family&&r.tx.childId===child).flatMap(r=>r.postings);
  const keys:AccountBucket[]=['UNALLOCATED','GIVE','SAVE','SPEND','EXTERNAL'];
  const result=Object.fromEntries(keys.map(key=>[key,0n])) as Record<AccountBucket,bigint>;
  for(const item of items)result[item.bucket]+=item.amount;
  return result;
 }
 async post(tx:MoneyTx,postings:readonly MoneyPosting[],_accounts:Record<AccountBucket,string>){
  balanced(postings);
  if(tx.jobId&&this.transactions.some(x=>x.tx.jobId===tx.jobId))throw new Error('Duplicate job credit');
  if(tx.correctionOf&&this.transactions.some(x=>x.tx.correctionOf===tx.correctionOf))throw new Error('Already reversed');
  this.transactions.push({tx,postings:[...postings]});
 }
 async history(family:string,child:string){
  return this.transactions.filter(r=>r.tx.familyId===family&&r.tx.childId===child);
 }
 async findTransaction(family:string,id:string){
  return this.transactions.find(r=>r.tx.familyId===family&&r.tx.id===id)??null;
 }
 async hasCorrection(family:string,id:string){
  return this.transactions.some(r=>r.tx.familyId===family&&r.tx.correctionOf===id);
 }
 async createSavingGoal(goal:SavingGoal){this.savingGoals.set(goal.id,goal)}
 async lockSavingGoal(family:string,id:string){
  const goal=this.savingGoals.get(id);return goal?.familyId===family?goal:null;
 }
 async listSavingGoals(family:string,child:string){
  return [...this.savingGoals.values()].filter(g=>g.familyId===family&&g.childId===child).map(g=>({
   ...g,allocatedMinor:this.earmarks.filter(a=>a.savingGoalId===g.id).reduce((sum,a)=>sum+a.amountMinor,0n).toString(),
  }));
 }
 async closeSavingGoal(family:string,id:string,version:number){
  const g=await this.lockSavingGoal(family,id);
  if(!g||g.version!==version||g.status!=='ACTIVE')return false;
  this.savingGoals.set(id,{...g,status:'CLOSED',version:g.version+1});return true;
 }
 async addSavingGoalAllocation(input:{id:string;familyId:string;childId:string;savingGoalId:string;amountMinor:bigint}){
  this.earmarks.push(input);
 }
 async activeSavingAllocations(family:string,child:string){
  return this.earmarks.filter(a=>a.familyId===family&&a.childId===child&&
   this.savingGoals.get(a.savingGoalId)?.status==='ACTIVE').reduce((sum,a)=>sum+a.amountMinor,0n);
 }
}
function setup(){
 const identity=new InMemoryIdentityRepository();
 identity.families.set(familyId,{id:familyId,name:'Family',timezone:'UTC',currency:'EGP',weeklyReviewDay:null,version:1});
 for(const id of [childId,siblingId])identity.children.set(id,{
  id,familyId,displayName:'Child',birthDate:'2018-01-01',avatarKey:null,status:'ACTIVE',version:1,
 });
 const jobRepo=new MemoryJobs(),moneyRepo=new MemoryMoney(jobRepo);
 const money=new MoneyService(moneyRepo,identity);
 const jobs=new JobService(jobRepo,identity,money);
 return {jobs,money,moneyRepo,jobRepo};
}
function action(job:Job,kind:'ACCEPT'|'START'|'SUBMIT'|'APPROVE'|'CREDIT'|'REQUEST_REVISION'|'RESTART',
 actor:ActorContext=guardian){
 return {jobId:job.id,action:kind,expectedVersion:job.version,occurredAt:now,now,actor};
}

describe('E8 job-to-money end-to-end domain services',()=>{
 it('requires accepted terms, submission and guardian approval before a single wallet credit',async()=>{
  const f=setup();
  const offered=await f.jobs.create(guardian,{
   childId,title:'Clean out extra books',criteria:'Sort the agreed book boxes',
   paymentMinor:'10000',now,
  });
  await expect(f.money.creditJob(guardian,{childId,jobId:offered.id,amountMinor:'10000',occurredAt:now,now}))
   .rejects.toMatchObject({code:'RESOURCE_STATE_CHANGED'});
  await expect(f.jobs.action({...action(offered,'APPROVE'),actor:child}))
   .rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(f.jobs.action({...action(offered,'ACCEPT'),actor:sibling}))
   .rejects.toMatchObject({code:'RESOURCE_NOT_FOUND'});
  const accepted=await f.jobs.action({...action(offered,'ACCEPT'),actor:child});
  const started=await f.jobs.action({...action(accepted,'START'),actor:child});
  const submitted=await f.jobs.action({...action(started,'SUBMIT'),actor:child});
  expect((await f.money.view(child,childId)).balances.unallocated).toBe('0');
  const approved=await f.jobs.action(action(submitted,'APPROVE'));
  expect(approved.status).toBe('AWAITING_CREDIT');
  expect((await f.money.view(child,childId)).balances.unallocated).toBe('0');
  await expect(f.jobs.action({...action(approved,'CREDIT'),actor:child}))
   .rejects.toMatchObject({code:'FORBIDDEN'});
  const credited=await f.jobs.action(action(approved,'CREDIT'));
  expect(credited.status).toBe('CREDITED');
  expect((await f.money.view(child,childId)).balances.unallocated).toBe('10000');
  expect(f.moneyRepo.transactions).toHaveLength(1);
  expect(f.moneyRepo.transactions[0]?.postings.reduce((sum,p)=>sum+p.amount,0n)).toBe(0n);
  await expect(f.jobs.action(action(approved,'CREDIT')))
   .rejects.toMatchObject({code:'STALE_VERSION'});
  expect(f.moneyRepo.transactions).toHaveLength(1);
 });
 it('guardian cannot silently lower payment after work begins; reoffer requires fresh acceptance',async()=>{
  const f=setup();
  const offered=await f.jobs.create(guardian,{childId,title:'Extra project',
   criteria:'Organize ten files',paymentMinor:'5000',now});
  const accepted=await f.jobs.action({...action(offered,'ACCEPT'),actor:child});
  const revised=await f.jobs.revise(guardian,{jobId:accepted.id,criteria:'Organize five files',
   paymentMinor:'2500',reason:'We agreed on a smaller new task',expectedVersion:accepted.version,now});
  expect(revised.status).toBe('OFFERED');
  expect(revised.termsVersion).toBe(2);
  expect(revised.acceptedTermsVersion).toBeNull();
  expect(f.jobRepo.revisions).toHaveLength(1);
  const reaccepted=await f.jobs.action({...action(revised,'ACCEPT'),actor:child});
  expect(reaccepted.acceptedTermsVersion).toBe(2);
  const inProgress=await f.jobs.action({...action(reaccepted,'START'),actor:child});
  await expect(f.jobs.revise(guardian,{jobId:inProgress.id,criteria:'Lower pay',
   paymentMinor:'1000',reason:'Unilateral cut',expectedVersion:inProgress.version,now}))
   .rejects.toMatchObject({code:'RESOURCE_STATE_CHANGED'});
  const submitted=await f.jobs.action({...action(inProgress,'SUBMIT'),actor:child});
  const approved=await f.jobs.action(action(submitted,'APPROVE'));
  await f.jobs.action(action(approved,'CREDIT'));
  expect((await f.money.view(child,childId)).balances.unallocated).toBe('2500');
 });
 it('allocation sums, spending, giving, corrections and access permissions',async()=>{
  const f=setup();
  await expect(f.money.recordIncome(child,{childId,kind:'GIFT',amountMinor:'10000',
   note:'Birthday',occurredAt:now,now})).rejects.toMatchObject({code:'FORBIDDEN'});
  const gift=await f.money.recordIncome(guardian,{childId,kind:'GIFT',
   amountMinor:'10000',note:'Birthday gift',occurredAt:now,now});
  await expect(f.money.allocate(guardian,{childId,giveMinor:'2000',saveMinor:'6000',
   spendMinor:'1999',occurredAt:now,now})).rejects.toMatchObject({code:'DOMAIN_RULE_VIOLATION'});
  await expect(f.money.allocate(child,{childId,giveMinor:'2000',saveMinor:'6000',
   spendMinor:'2000',occurredAt:now,now})).rejects.toMatchObject({code:'FORBIDDEN'});
  await f.money.allocate(guardian,{childId,giveMinor:'2000',saveMinor:'6000',
   spendMinor:'2000',occurredAt:now,now});
  await expect(f.money.outgoing(guardian,{childId,kind:'SPEND',amountMinor:'2001',
   note:'Overspend',occurredAt:now,now})).rejects.toMatchObject({code:'INSUFFICIENT_FUNDS'});
  const spent=await f.money.outgoing(guardian,{childId,kind:'SPEND',amountMinor:'500',
   note:'Book bought',occurredAt:now,now});
  await f.money.outgoing(guardian,{childId,kind:'GIVING',amountMinor:'1000',
   note:'Donation',occurredAt:now,now});
  let wallet=await f.money.view(child,childId);
  expect(wallet.balances).toEqual({unallocated:'0',give:'1000',save:'6000',spend:'1500'});
  await expect(f.money.correct(child,{transactionId:spent.id,reason:'Mistake recorded',
   occurredAt:now,now})).rejects.toMatchObject({code:'FORBIDDEN'});
  const correction=await f.money.correct(guardian,{transactionId:spent.id,
   reason:'Duplicate spending record',occurredAt:now,now});
  expect(correction.correctionOf).toBe(spent.id);
  wallet=await f.money.view(child,childId);
  expect(wallet.balances.spend).toBe('2000');
  await expect(f.money.correct(guardian,{transactionId:spent.id,
   reason:'Try again',occurredAt:now,now})).rejects.toMatchObject({code:'RESOURCE_STATE_CHANGED'});
  await expect(f.money.correct(guardian,{transactionId:gift.id,
   reason:'Wrong gift',occurredAt:now,now})).rejects.toMatchObject({code:'INSUFFICIENT_FUNDS'});
  await expect(f.money.view(sibling,childId)).rejects.toMatchObject({code:'RESOURCE_NOT_FOUND'});
  expect(f.moneyRepo.transactions).toHaveLength(5);
 });
 it('saving goals earmark existing SAVE and closing never moves to SPEND',async()=>{
  const f=setup();
  await f.money.recordIncome(guardian,{childId,kind:'ALLOWANCE',amountMinor:'10000',note:'Weekly allowance',occurredAt:now,now});
  await f.money.allocate(guardian,{childId,giveMinor:'2000',saveMinor:'6000',spendMinor:'2000',occurredAt:now,now});
  const g=await f.money.createSavingGoal(guardian,{childId,title:'A new book',targetMinor:'5000'});
  await f.money.allocateToSavingGoal(guardian,{savingGoalId:g.id,amountMinor:'4000'});
  expect((await f.money.view(child,childId)).savingGoals[0]?.allocatedMinor).toBe('4000');
  await expect(f.money.allocateToSavingGoal(guardian,{savingGoalId:g.id,amountMinor:'2000'}))
   .rejects.toMatchObject({code:'INSUFFICIENT_FUNDS'});
  const closed=await f.money.closeSavingGoal(guardian,g.id,1);
  expect(closed.status).toBe('CLOSED');
  const wallet=await f.money.view(child,childId);
  expect(wallet.balances.save).toBe('6000');
  expect(wallet.balances.spend).toBe('2000');
  expect(wallet.savingGoals[0]?.status).toBe('CLOSED');
  await expect(f.money.allocateToSavingGoal(guardian,{savingGoalId:g.id,amountMinor:'100'}))
   .rejects.toMatchObject({code:'RESOURCE_STATE_CHANGED'});
 });
});
