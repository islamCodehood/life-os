import { z } from 'zod';

const base = z.object({
  commandId: z.string().uuid(),
  schemaVersion: z.literal(1),
  occurredAt: z.string().datetime(),
  clientSequence: z.number().int().nonnegative().optional(),
  expectedVersions: z
    .array(
      z.object({
        resourceType: z.string(),
        resourceId: z.string().uuid(),
        version: z.number().int().positive(),
      }),
    )
    .optional(),
});
const goalId = z.string().uuid();
const goalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const goalText = z.string().trim().min(1).max(140);
const goalAmount = z.number().int().min(1).max(1000000);
export const e7CommandSchema = z.discriminatedUnion('type', [
  base.extend({
    type: z.literal('CreateGoal'),
    payload: z.object({
      ownerType: z.enum(['CHILD', 'FAMILY']),
      ownerChildId: goalId.nullable(),
      category: z.enum(['PERSONAL', 'GROWTH', 'PROJECT', 'SHARED']),
      title: goalText,
      why: z.string().trim().min(1).max(400),
      nextStep: z.string().trim().min(1).max(200),
      target: goalAmount,
      targetDate: goalDate,
    }),
  }),
  base.extend({ type: z.literal('ApproveGoal'), payload: z.object({ goalId }) }),
  base.extend({
    type: z.literal('AddGoalProgress'),
    payload: z.object({
      goalId,
      amount: goalAmount,
      step: z.string().trim().min(1).max(200),
    }),
  }),
  base.extend({
    type: z.literal('ReviseGoal'),
    payload: z.object({
      goalId,
      target: goalAmount,
      targetDate: goalDate,
      reason: z.string().trim().min(4).max(400),
    }),
  }),
  base.extend({ type: z.literal('PauseGoal'), payload: z.object({ goalId }) }),
  base.extend({ type: z.literal('ResumeGoal'), payload: z.object({ goalId }) }),
  base.extend({ type: z.literal('AchieveGoal'), payload: z.object({ goalId }) }),
  base.extend({ type: z.literal('CloseGoal'), payload: z.object({ goalId }) }),
  base.extend({
    type: z.literal('RecordGoalReflection'),
    payload: z.object({
      goalId,
      text: z.string().trim().min(2).max(1000),
    }),
  }),
]);
