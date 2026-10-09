import { z } from 'zod';

const base = z.object({
  commandId: z.string().uuid(),
  schemaVersion: z.literal(1),
  occurredAt: z.string().datetime(),
  clientSequence: z.number().int().nonnegative().optional(),
  expectedVersions: z
    .array(
      z.object({
        resourceType: z.string().min(1),
        resourceId: z.string().uuid(),
        version: z.number().int().positive(),
      }),
    )
    .optional(),
});

const suggestion = z.object({ suggestionId: z.string().uuid() });
export const e5CommandSchema = z.discriminatedUnion('type', [
  base.extend({
    type: z.literal('RequestGraduationReview'),
    payload: z.object({
      assignmentId: z.string().uuid(),
    }),
  }),
  base.extend({
    type: z.literal('ApproveGraduation'),
    payload: suggestion.extend({
      monitoringIntervalDays: z.number().int().min(1).max(90).default(14),
    }),
  }),
  base.extend({ type: z.literal('DeclineGraduation'), payload: suggestion }),
  base.extend({ type: z.literal('SnoozeGraduation'), payload: suggestion }),
  base.extend({
    type: z.literal('RecordGraduatedObservation'),
    payload: z.object({
      graduationRecordId: z.string().uuid(),
      result: z.enum(['STABLE', 'SOMETIMES_NEEDS_HELP', 'NEEDS_REGULAR_SUPPORT']),
    }),
  }),
  base.extend({ type: z.literal('ApproveReactivation'), payload: suggestion }),
  base.extend({ type: z.literal('DeclineReactivation'), payload: suggestion }),
]);
export type E5Command = z.infer<typeof e5CommandSchema>;
