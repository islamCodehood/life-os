import { z } from 'zod';
import { prompts } from '@/src/domain/weekly-review/review';
const uuid = z.string().uuid();
const base = z.object({
  commandId: uuid,
  schemaVersion: z.literal(1),
  occurredAt: z.string().datetime(),
});
export const e11CommandSchema = z.discriminatedUnion('type', [
  base.extend({ type: z.literal('StartWeeklyReview'), payload: z.object({}) }),
  base.extend({
    type: z.literal('SaveWeeklyReviewEntry'),
    payload: z.object({
      reviewId: uuid,
      prompt: z.enum(prompts),
      text: z.string().trim().min(1).max(1200),
      expectedEntryVersion: z.number().int().nonnegative(),
    }),
  }),
  base.extend({
    type: z.literal('CompleteWeeklyReview'),
    payload: z.object({
      reviewId: uuid,
      expectedReviewVersion: z.number().int().positive(),
      nextFocus: z.string().trim().min(3).max(240),
    }),
  }),
  base.extend({
    type: z.literal('SkipWeeklyReview'),
    payload: z.object({
      reviewId: uuid,
      expectedReviewVersion: z.number().int().positive(),
    }),
  }),
]);
