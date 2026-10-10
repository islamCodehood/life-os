import { z } from 'zod';

const base = z.object({
  commandId: z.string().uuid(),
  schemaVersion: z.literal(1),
  occurredAt: z.string().datetime(),
  clientSequence: z.number().int().nonnegative().optional(),
  expectedVersions: z.array(z.object({
    resourceType: z.string().min(1),
    resourceId: z.string().uuid(),
    version: z.number().int().positive(),
  })).optional(),
});

export const e6CommandSchema = z.discriminatedUnion('type', [
  base.extend({ type: z.literal('AssignGrowthPractice'), payload: z.object({
    childId: z.string().uuid(),
    templateKey: z.enum(['GROWTH_READING','GROWTH_CHESS_PRACTICE']),
  }) }),
  base.extend({ type: z.literal('CorrectXpGrant'), payload: z.object({
    xpEntryId: z.string().uuid(),
    reason: z.string().trim().min(5).max(400),
  }) }),
]);
