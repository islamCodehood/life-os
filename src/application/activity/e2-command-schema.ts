import { z } from 'zod';

const expectedVersion = z.object({
  resourceType: z.string().min(1),
  resourceId: z.string().uuid(),
  version: z.number().int().positive(),
});

const base = z.object({
  commandId: z.string().uuid(),
  schemaVersion: z.literal(1),
  occurredAt: z.string().datetime(),
  clientSequence: z.number().int().nonnegative().optional(),
  expectedVersions: z.array(expectedVersion).optional(),
});

export const e2CommandSchema = z.discriminatedUnion('type', [
  base.extend({
    type: z.literal('AssignMakeBed'),
    payload: z.object({
      childId: z.string().uuid(),
    }),
  }),
  base.extend({
    type: z.literal('CompleteActivity'),
    payload: z.object({
      activityInstanceId: z.string().uuid(),
    }),
  }),
]);

export type E2Command = z.infer<typeof e2CommandSchema>;
