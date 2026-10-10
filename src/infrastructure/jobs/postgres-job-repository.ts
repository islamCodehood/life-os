import {and,eq,sql} from 'drizzle-orm';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import * as s from '@/src/infrastructure/database/schema';
import type {JobRepository} from '@/src/application/jobs/job-repository';
import type {Job} from '@/src/domain/jobs/job';
type Db=NodePgDatabase<typeof s>;
function rowToJob(r:typeof s.jobs.$inferSelect):Job {
 return {...r,paymentMinor:r.paymentMinor.toString(),status:r.status as Job['status']};
}
export class PostgresJobRepository implements JobRepository {
 constructor(private readonly db:Db){}
 async create(job:Job){await this.db.insert(s.jobs).values({...job,paymentMinor:BigInt(job.paymentMinor)});}
 async lock(familyId:string,id:string){
  const [r]=await this.db.select().from(s.jobs).where(and(eq(s.jobs.familyId,familyId),eq(s.jobs.id,id))).for('update').limit(1);
  return r?rowToJob(r):null;
 }
 async get(familyId:string,id:string){
  const [r]=await this.db.select().from(s.jobs).where(and(eq(s.jobs.familyId,familyId),eq(s.jobs.id,id))).limit(1);
  return r?rowToJob(r):null;
 }
 async listChild(familyId:string,childId:string){
  const rows=await this.db.select().from(s.jobs).where(and(eq(s.jobs.familyId,familyId),eq(s.jobs.childId,childId))).orderBy(s.jobs.createdAt);
  return rows.map(rowToJob);
 }
 async listFamily(familyId:string){
  const rows=await this.db.select().from(s.jobs).where(eq(s.jobs.familyId,familyId)).orderBy(s.jobs.createdAt);
  return rows.map(rowToJob);
 }
 async update(input:{familyId:string;id:string;expectedVersion:number;patch:Partial<Pick<Job,'status'|'criteria'|'paymentMinor'|'termsVersion'|'acceptedTermsVersion'>>;now:Date}){
  const {paymentMinor,...rest}=input.patch;
  const [r]=await this.db.update(s.jobs).set({
   ...rest,...(paymentMinor===undefined?{}:{paymentMinor:BigInt(paymentMinor)}),
   version:sql`${s.jobs.version}+1`,updatedAt:input.now,
  }).where(and(eq(s.jobs.familyId,input.familyId),eq(s.jobs.id,input.id),eq(s.jobs.version,input.expectedVersion))).returning();
  return r?rowToJob(r):null;
 }
 async recordRevision(input:{id:string;familyId:string;jobId:string;termsVersion:number;criteria:string;paymentMinor:string;reason:string;now:Date}){
   await this.db.insert(s.jobRevisions).values({
    id:input.id,familyId:input.familyId,jobId:input.jobId,
    termsVersion:input.termsVersion,criteria:input.criteria,paymentMinor:BigInt(input.paymentMinor),
    reason:input.reason,createdAt:input.now,
   });
 }
}
