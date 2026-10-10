import { z } from 'zod';
const id = z.string().uuid();
export const momentPrivacySchema = z.enum(['CHILD_SAFE', 'FAMILY_SHARED', 'GUARDIAN_PRIVATE']);
export const momentTagSchema = z.enum([
  'KINDNESS',
  'HONESTY',
  'GENEROSITY',
  'COURAGE',
  'PATIENCE',
  'PERSEVERANCE',
  'FAMILY',
  'INITIATIVE',
]);
const base = z.object({
  commandId: id,
  schemaVersion: z.literal(1),
  occurredAt: z.string().datetime(),
  clientSequence: z.number().int().nonnegative().optional(),
  expectedVersions: z
    .array(
      z.object({ resourceType: z.string(), resourceId: id, version: z.number().int().positive() }),
    )
    .optional(),
});
const fields = z.object({
  subjectChildId: id.nullable(),
  privacy: momentPrivacySchema,
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().min(2).max(1000),
  tags: z.array(momentTagSchema).max(5),
  momentOccurredAt: z.string().datetime(),
});
export const e9CommandSchema = z.discriminatedUnion('type', [
  base.extend({ type: z.literal('RecordMoment'), payload: fields }),
  base.extend({
    type: z.literal('UpdateMoment'),
    payload: fields.extend({
      momentId: id,
      reason: z.string().trim().min(4).max(250),
    }),
  }),
  base.extend({
    type: z.literal('ArchiveMoment'),
    payload: z.object({
      momentId: id,
      reason: z.string().trim().min(4).max(250),
    }),
  }),
]);
