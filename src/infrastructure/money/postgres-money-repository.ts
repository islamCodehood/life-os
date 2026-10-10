import {and,eq,sql,inArray} from 'drizzle-orm';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import {newId} from '@/src/domain/shared/id';
import type {AccountBucket,MoneyPosting} from '@/src/domain/money/ledger';
import type {MoneyRepository,MoneyTx,SavingGoal} from '@/src/application/money/money-repository';
import * as s from '@/src/infrastructure/database/schema';
type Db=NodePgDatabase<typeof s>;
const buckets:AccountBucket[]=['UNALLOCATED','GIVE','SAVE','SPEND','EXTERNAL'];
function rowToTx(r:typeof s.moneyTransactions.$inferSelect):MoneyTx {
 return {...r,kind:r.kind as MoneyTx['kind']};
}
function rowToSaving(r:typeof s.savingGoals.$inferSelect):SavingGoal {
 return {...r,targetMinor:r.targetMinor.toString(),status:r.status as SavingGoal['status']};
}
export class PostgresMoneyRepository implements MoneyRepository {
 constructor(private readonly db:Db){}
 async lockWallet(familyId:string,childId:string){
  await this.db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'wallet:'+familyId+':'+childId},0))`);
 }
 async ensureAccounts(familyId:string,childId:string,currency:string){
  for(const bucket of buckets){
   await this.db.insert(s.moneyAccounts).values({id:newId<'AccountId'>(),familyId,childId,bucket,currency})
      .onConflictDoNothing({target:[s.moneyAccounts.familyId,s.moneyAccounts.childId,s.moneyAccounts.bucket]});
  }
  const rows=await this.db.select().from(s.moneyAccounts).where(and(
   eq(s.moneyAccounts.familyId,familyId),eq(s.moneyAccounts.childId,childId),
  ));
  if(rows.length!==5||rows.some(r=>r.currency!==currency))throw new Error('Wallet currency/account mismatch.');
  return Object.fromEntries(rows.map(r=>[r.bucket,r.id])) as Record<AccountBucket,string>;
 }
 async balances(familyId:string,childId:string){
  const rows=await this.db.select({bucket:s.moneyAccounts.bucket,amount:s.moneyPostings.amountMinor})
    .from(s.moneyPostings).innerJoin(s.moneyAccounts,eq(s.moneyPostings.accountId,s.moneyAccounts.id))
    .where(and(eq(s.moneyPostings.familyId,familyId),eq(s.moneyPostings.childId,childId)));
  const sums=Object.fromEntries(buckets.map(k=>[k,0n])) as Record<AccountBucket,bigint>;
  for(const row of rows){if(row.bucket in sums)sums[row.bucket as AccountBucket]+=row.amount;}
  return sums;
 }
 async post(tx:MoneyTx,postings:readonly MoneyPosting[],accounts:Record<AccountBucket,string>){
  await this.db.insert(s.moneyTransactions).values(tx);
  await this.db.insert(s.moneyPostings).values(postings.map(p=>({
    id:newId<'PostingId'>(),familyId:tx.familyId,childId:tx.childId,
    transactionId:tx.id,accountId:accounts[p.bucket],amountMinor:p.amount,
  })));
 }
 async history(familyId:string,childId:string){
  const rows=await this.db.select().from(s.moneyTransactions)
    .where(and(eq(s.moneyTransactions.familyId,familyId),eq(s.moneyTransactions.childId,childId)))
    .orderBy(s.moneyTransactions.recordedAt);
  if(!rows.length)return [];
  const ps=await this.db.select({tx:s.moneyPostings.transactionId,bucket:s.moneyAccounts.bucket,amount:s.moneyPostings.amountMinor})
    .from(s.moneyPostings).innerJoin(s.moneyAccounts,eq(s.moneyAccounts.id,s.moneyPostings.accountId))
    .where(and(eq(s.moneyPostings.familyId,familyId),eq(s.moneyPostings.childId,childId),
     inArray(s.moneyPostings.transactionId,rows.map(r=>r.id))));
  return rows.map(row=>({tx:rowToTx(row),postings:ps.filter(p=>p.tx===row.id).map(p=>({
    bucket:p.bucket as AccountBucket,amount:p.amount,
  }))}));
 }
 async findTransaction(familyId:string,id:string){
  const [row]=await this.db.select().from(s.moneyTransactions)
    .where(and(eq(s.moneyTransactions.familyId,familyId),eq(s.moneyTransactions.id,id))).limit(1);
  if(!row)return null;
  const postings=await this.db.select({bucket:s.moneyAccounts.bucket,amount:s.moneyPostings.amountMinor})
    .from(s.moneyPostings).innerJoin(s.moneyAccounts,eq(s.moneyPostings.accountId,s.moneyAccounts.id))
    .where(and(eq(s.moneyPostings.familyId,familyId),eq(s.moneyPostings.transactionId,id)));
  return {tx:rowToTx(row),postings:postings.map(p=>({bucket:p.bucket as AccountBucket,amount:p.amount}))};
 }
 async hasCorrection(familyId:string,id:string){
  const [r]=await this.db.select({id:s.moneyTransactions.id}).from(s.moneyTransactions)
   .where(and(eq(s.moneyTransactions.familyId,familyId),eq(s.moneyTransactions.correctionOf,id))).limit(1);
  return !!r;
 }
 async createSavingGoal(goal:SavingGoal){
  await this.db.insert(s.savingGoals).values({...goal,targetMinor:BigInt(goal.targetMinor)});
 }
 async lockSavingGoal(familyId:string,id:string){
  const [r]=await this.db.select().from(s.savingGoals).where(and(
   eq(s.savingGoals.familyId,familyId),eq(s.savingGoals.id,id))).for('update').limit(1);
  return r?rowToSaving(r):null;
 }
 async listSavingGoals(familyId:string,childId:string){
  const gs=await this.db.select().from(s.savingGoals).where(and(
   eq(s.savingGoals.familyId,familyId),eq(s.savingGoals.childId,childId)));
  const allocations=await this.db.select().from(s.savingGoalAllocations).where(and(
   eq(s.savingGoalAllocations.familyId,familyId),eq(s.savingGoalAllocations.childId,childId)));
  return gs.map(g=>({...rowToSaving(g),allocatedMinor:allocations.filter(a=>a.savingGoalId===g.id)
    .reduce((sum,a)=>sum+a.amountMinor,0n).toString()}));
 }
 async closeSavingGoal(familyId:string,id:string,version:number){
  const [r]=await this.db.update(s.savingGoals).set({status:'CLOSED',version:sql`${s.savingGoals.version}+1`})
   .where(and(eq(s.savingGoals.familyId,familyId),eq(s.savingGoals.id,id),
     eq(s.savingGoals.status,'ACTIVE'),eq(s.savingGoals.version,version))).returning({id:s.savingGoals.id});
  return !!r;
 }
 async addSavingGoalAllocation(input:{id:string;familyId:string;childId:string;savingGoalId:string;amountMinor:bigint}){
  await this.db.insert(s.savingGoalAllocations).values(input);
 }
 async activeSavingAllocations(familyId:string,childId:string){
  const entries=await this.db.select({amount:s.savingGoalAllocations.amountMinor}).from(s.savingGoalAllocations)
    .innerJoin(s.savingGoals,eq(s.savingGoals.id,s.savingGoalAllocations.savingGoalId))
    .where(and(eq(s.savingGoalAllocations.familyId,familyId),eq(s.savingGoalAllocations.childId,childId),
      eq(s.savingGoals.status,'ACTIVE')));
  return entries.reduce((sum,e)=>sum+e.amount,0n);
 }
}
