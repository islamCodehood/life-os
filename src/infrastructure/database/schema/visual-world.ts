import {foreignKey,index,text,timestamp,uniqueIndex,uuid} from 'drizzle-orm/pg-core';
import {lifeOsSchema} from '../schema-root';
import {families,childProfiles} from './identity';
import {domainEvents} from './system';
export const worldUnlocks=lifeOsSchema.table('world_unlocks',{
 id:uuid('id').primaryKey(),
 familyId:uuid('family_id').notNull().references(()=>families.id,{onDelete:'cascade'}),
 childId:uuid('child_id'),worldScope:text('world_scope').notNull(),
 semanticDimension:text('semantic_dimension').notNull(),
 milestoneKey:text('milestone_key').notNull(),
 sourceEventId:uuid('source_event_id').notNull().references(()=>domainEvents.id),
 unlockedAt:timestamp('unlocked_at',{withTimezone:true}).notNull(),
},t=>[
 uniqueIndex('world_source_milestone_unique').on(t.familyId,t.sourceEventId,t.milestoneKey),
 index('world_child_scope_idx').on(t.familyId,t.worldScope,t.childId,t.unlockedAt),
 foreignKey({columns:[t.childId,t.familyId],foreignColumns:[childProfiles.id,childProfiles.familyId],name:'world_unlocks_family_child_fk'}),
]);
