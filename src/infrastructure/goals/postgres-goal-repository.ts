import {and,eq,or,sql} from 'drizzle-orm';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import type {GoalRepository} from '@/src/application/goals/goal-repository';
import type {Goal,GoalProgressEntry,GoalRevision,GoalReflection} from '@/src/domain/goals/goal';
import * as s from '@/src/infrastructure/database/schema';
type Db=NodePgDatabase<typeof s>;
function goalRow(row:typeof s.goals.$inferSelect):Goal {
 return {...row,ownerType:row.ownerType as Goal['ownerType'],
   category:row.category as Goal['category'],status:row.status as Goal['status']};
}
function progressRow(row:typeof s.goalProgressEntries.$inferSelect):GoalProgressEntry {return row;}
function revisionRow(row:typeof s.goalRevisions.$inferSelect):GoalRevision {return row;}
function reflectionRow(row:typeof s.goalReflections.$inferSelect):GoalReflection {return row;}
export class PostgresGoalRepository implements GoalRepository {
 constructor(private readonly db:Db) {}
 async insertGoal(goal:Goal){
   await this.db.insert(s.goals).values(goal);
 }
 async getGoal(familyId:string,goalId:string){
   const [row]=await this.db.select().from(s.goals).where(and(
     eq(s.goals.familyId,familyId),eq(s.goals.id,goalId)
   )).limit(1);
   return row?goalRow(row):null;
 }
 async lockGoal(familyId:string,goalId:string){
   const [row]=await this.db.select().from(s.goals).where(and(
     eq(s.goals.familyId,familyId),eq(s.goals.id,goalId)
   )).for('update').limit(1);
   return row?goalRow(row):null;
 }
 async listChildVisible(familyId:string,childId:string){
   const rows=await this.db.select().from(s.goals).where(and(
     eq(s.goals.familyId,familyId),or(
       eq(s.goals.ownerType,'FAMILY'),
       and(eq(s.goals.ownerType,'CHILD'),eq(s.goals.ownerChildId,childId)),
     ),
   )).orderBy(s.goals.createdAt);
   return rows.map(goalRow);
 }
 async listFamilyGoals(familyId:string){
   const rows=await this.db.select().from(s.goals)
     .where(eq(s.goals.familyId,familyId)).orderBy(s.goals.createdAt);
   return rows.map(goalRow);
 }
 async insertProgress(entry:GoalProgressEntry){
   await this.db.insert(s.goalProgressEntries).values(entry);
 }
 async insertRevision(revision:GoalRevision){
   await this.db.insert(s.goalRevisions).values(revision);
 }
 async insertReflection(reflection:GoalReflection){
   await this.db.insert(s.goalReflections).values(reflection);
 }
 async updateGoal(input:{
   familyId:string;id:string;expectedVersion:number;
   patch:Partial<Pick<Goal,'target'|'targetDate'|'progress'|'nextStep'|'status'>>;
   updatedAt:Date;
 }){
   const [row]=await this.db.update(s.goals).set({
      ...input.patch,updatedAt:input.updatedAt,version:sql`${s.goals.version} + 1`,
   }).where(and(eq(s.goals.familyId,input.familyId),eq(s.goals.id,input.id),
     eq(s.goals.version,input.expectedVersion))).returning();
   return row?goalRow(row):null;
 }
 async listProgress(familyId:string,goalId:string){
   const rows=await this.db.select().from(s.goalProgressEntries).where(and(
     eq(s.goalProgressEntries.familyId,familyId),eq(s.goalProgressEntries.goalId,goalId)
   )).orderBy(s.goalProgressEntries.recordedAt);
   return rows.map(progressRow);
 }
 async listRevisions(familyId:string,goalId:string){
   const rows=await this.db.select().from(s.goalRevisions).where(and(
     eq(s.goalRevisions.familyId,familyId),eq(s.goalRevisions.goalId,goalId)
   )).orderBy(s.goalRevisions.revisedAt);
   return rows.map(revisionRow);
 }
 async listReflections(familyId:string,goalId:string){
   const rows=await this.db.select().from(s.goalReflections).where(and(
     eq(s.goalReflections.familyId,familyId),eq(s.goalReflections.goalId,goalId)
   )).orderBy(s.goalReflections.createdAt);
   return rows.map(reflectionRow);
 }
}
