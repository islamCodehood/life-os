import {foreignKey,index,integer,text,timestamp,uniqueIndex,uuid,date} from 'drizzle-orm/pg-core';
import {lifeOsSchema} from '../schema-root';
import {families,childProfiles} from './identity';
export const goals=lifeOsSchema.table('goals',{
  id:uuid('id').primaryKey(),
  familyId:uuid('family_id').notNull().references(()=>families.id,{onDelete:'cascade'}),
  ownerType:text('owner_type').notNull(),
  ownerChildId:uuid('owner_child_id'),proposedByChildId:uuid('proposed_by_child_id'),
  category:text('category').notNull(),title:text('title').notNull(),why:text('why').notNull(),
  nextStep:text('next_step').notNull(),target:integer('target').notNull(),
  progress:integer('progress').notNull().default(0),
  targetDate:date('target_date',{mode:'string'}),status:text('status').notNull(),
  version:integer('version').notNull().default(1),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},table=>[
  uniqueIndex('goals_family_pair_unique').on(table.id,table.familyId),
  index('goals_family_owner_idx').on(table.familyId,table.ownerType,table.ownerChildId),
  foreignKey({columns:[table.ownerChildId,table.familyId],foreignColumns:[childProfiles.id,childProfiles.familyId],name:'goals_child_family_fk'}),
  foreignKey({columns:[table.proposedByChildId,table.familyId],foreignColumns:[childProfiles.id,childProfiles.familyId],name:'goals_proposer_family_fk'}),
]);
export const goalProgressEntries=lifeOsSchema.table('goal_progress_entries',{
  id:uuid('id').primaryKey(),familyId:uuid('family_id').notNull(),
  goalId:uuid('goal_id').notNull(),contributedByChildId:uuid('contributed_by_child_id'),
  amount:integer('amount').notNull(),step:text('step').notNull(),
  occurredAt:timestamp('occurred_at',{withTimezone:true}).notNull(),
  recordedAt:timestamp('recorded_at',{withTimezone:true}).notNull().defaultNow(),
},table=>[
  index('goal_progress_goal_idx').on(table.familyId,table.goalId,table.recordedAt),
  foreignKey({columns:[table.goalId,table.familyId],foreignColumns:[goals.id,goals.familyId],name:'goal_progress_goal_fk'}).onDelete('cascade'),
  foreignKey({columns:[table.contributedByChildId,table.familyId],foreignColumns:[childProfiles.id,childProfiles.familyId],name:'goal_progress_child_fk'}),
]);
export const goalRevisions=lifeOsSchema.table('goal_revisions',{
  id:uuid('id').primaryKey(),familyId:uuid('family_id').notNull(),goalId:uuid('goal_id').notNull(),
  previousTarget:integer('previous_target').notNull(),newTarget:integer('new_target').notNull(),
  previousTargetDate:date('previous_target_date',{mode:'string'}),
  newTargetDate:date('new_target_date',{mode:'string'}),
  reason:text('reason').notNull(),
  revisedAt:timestamp('revised_at',{withTimezone:true}).notNull().defaultNow(),
},table=>[
  index('goal_revisions_goal_idx').on(table.familyId,table.goalId,table.revisedAt),
  foreignKey({columns:[table.goalId,table.familyId],foreignColumns:[goals.id,goals.familyId],name:'goal_revisions_goal_fk'}).onDelete('cascade'),
]);
export const goalReflections=lifeOsSchema.table('goal_reflections',{
  id:uuid('id').primaryKey(),familyId:uuid('family_id').notNull(),goalId:uuid('goal_id').notNull(),
  authorChildId:uuid('author_child_id'),text:text('text').notNull(),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},table=>[
  index('goal_reflections_goal_idx').on(table.familyId,table.goalId,table.createdAt),
  foreignKey({columns:[table.goalId,table.familyId],foreignColumns:[goals.id,goals.familyId],name:'goal_reflections_goal_fk'}).onDelete('cascade'),
  foreignKey({columns:[table.authorChildId,table.familyId],foreignColumns:[childProfiles.id,childProfiles.familyId],name:'goal_reflections_child_fk'}),
]);
