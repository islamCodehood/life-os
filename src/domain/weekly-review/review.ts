import type { AgeProfile } from '@/src/domain/identity/experience';
export const prompts = [
  'PROUD',
  'DIFFICULT',
  'LEARNED',
  'HELPED',
  'IMPROVE',
  'NEXT_FOCUS',
] as const;
export type ReviewPrompt = (typeof prompts)[number];
export type ReviewStatus = 'OPEN' | 'COMPLETED' | 'SKIPPED' | 'ABANDONED';
export type ReviewActor = 'CHILD' | 'GUARDIAN';
export interface WeeklyReview {
  id: string;
  familyId: string;
  weekStart: string;
  weekEnd: string;
  reviewOn: string;
  timezone: string;
  status: ReviewStatus;
  nextFocus: string | null;
  version: number;
  startedAt: Date;
  finishedAt: Date | null;
}
export interface ReviewEntry {
  id: string;
  familyId: string;
  reviewId: string;
  authorKey: string;
  authorKind: ReviewActor;
  authorChildId: string | null;
  authorGuardianId: string | null;
  prompt: ReviewPrompt;
  text: string;
  version: number;
  updatedAt: Date;
}
export class ReviewRuleError extends Error {}
function dateOnly(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ReviewRuleError('Invalid local date.');
  const parsed = new Date(date + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
    throw new ReviewRuleError('Invalid local date.');
  return parsed;
}
export function shiftDate(date: string, offset: number): string {
  const d = dateOnly(date);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function reviewWindow(localToday: string, day: number | null) {
  const today = dateOnly(localToday);
  // JS Sunday=0, ... Saturday=6; null uses Friday as an editable family default.
  const target = day ?? 5;
  if (!Number.isInteger(target) || target < 0 || target > 6)
    throw new ReviewRuleError('Invalid review day.');
  const offset = (today.getUTCDay() - target + 7) % 7;
  const reviewOn = shiftDate(localToday, -offset);
  return { reviewOn, weekStart: shiftDate(reviewOn, -7), weekEnd: reviewOn };
}
export function validateReflection(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length < 1 || trimmed.length > 1200)
    throw new ReviewRuleError('Reflection must be 1–1200 characters.');
  return trimmed;
}
export function validateFocus(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length < 3 || trimmed.length > 240)
    throw new ReviewRuleError('Next-week focus must be 3–240 characters.');
  return trimmed;
}
export function canEditReview(status: ReviewStatus): boolean {
  return status === 'OPEN';
}
export function presentation(profile: AgeProfile | null): 'ILLUSTRATED' | 'CARD' | 'REFLECTION' {
  if (profile === 'EXPLORER') return 'ILLUSTRATED';
  if (profile === 'BUILDER') return 'CARD';
  return 'REFLECTION';
}
export type WeeklySummary = {
  window: { weekStart: string; weekEnd: string };
  completedResponsibilities: number;
  practisedSkills: number;
  achievedGoals: number;
  sharedMoments: number;
  personalMoments: number;
};
