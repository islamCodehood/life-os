import {foreignKey,index,integer,jsonb,text,timestamp,uniqueIndex,uuid} from 'drizzle-orm/pg-core';
import {lifeOsSchema} from '../schema-root';
import {childProfiles,families} from './identity';
export const moments=lifeOsSchema.table('moments',{
 id:uuid('id').primaryKey(),familyId:uuid('family_id').notNull().references(()=>families.id,{onDelete:'cascade'}),
 subjectChildId:uuid('subject_child_id'),authorKind:text('author_kind').notNull(),
 authorChildId:uuid('author_child_id'),title:text('title').notNull(),
 description:text('description').notNull(),privacy:text('privacy').notNull(),
 occurredAt:timestamp('occurred_at',{withTimezone:true}).notNull(),
 createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
 updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
 status:text('status').notNull().default('PUBLISHED'),
 version:integer('version').notNull().default(1),
},t=>[
 uniqueIndex('moments_id_family_uidx').on(t.id,t.familyId),
 index('moments_private_idx').on(t.familyId,t.subjectChildId,t.occurredAt),
 index('moments_family_shared_idx').on(t.familyId,t.privacy,t.occurredAt),
 foreignKey({columns:[t.subjectChildId,t.familyId],foreignColumns:[childProfiles.id,childProfiles.familyId],name:'moments_child_family_fk'}),
 foreignKey({columns:[t.authorChildId,t.familyId],foreignColumns:[childProfiles.id,childProfiles.familyId],name:'moments_author_family_fk'}),
]);
export const momentTags=lifeOsSchema.table('moment_tags',{
 id:uuid('id').primaryKey(),familyId:uuid('family_id').notNull(),momentId:uuid('moment_id').notNull(),
 momentVersion:integer('moment_version').notNull(),tag:text('tag').notNull(),
},t=>[
 uniqueIndex('moment_tags_unique').on(t.momentId,t.momentVersion,t.tag),
 index('moment_tags_version_idx').on(t.familyId,t.momentId,t.momentVersion),
 foreignKey({columns:[t.momentId,t.familyId],foreignColumns:[moments.id,moments.familyId],name:'moment_tags_moment_fk'}),
]);
export const momentRevisions=lifeOsSchema.table('moment_revisions',{
 id:uuid('id').primaryKey(),familyId:uuid('family_id').notNull(),momentId:uuid('moment_id').notNull(),
 version:integer('version').notNull(),action:text('action').notNull(),
 beforeSnapshot:jsonb('before_snapshot'),afterSnapshot:jsonb('after_snapshot').notNull(),
 editedByKind:text('edited_by_kind').notNull(),
 editedAt:timestamp('edited_at',{withTimezone:true}).notNull().defaultNow(),reason:text('reason'),
},t=>[
 uniqueIndex('moment_revisions_unique').on(t.momentId,t.version),
 foreignKey({columns:[t.momentId,t.familyId],foreignColumns:[moments.id,moments.familyId],name:'moment_revisions_moment_fk'}),
]);
