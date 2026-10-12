import type { ReviewEntry, WeeklyReview, WeeklySummary } from '@/src/domain/weekly-review/review';
export type WeeklyReviewView = {
  review: null | {
    id: string;
    weekStart: string;
    weekEnd: string;
    reviewOn: string;
    status: WeeklyReview['status'];
    nextFocus: string | null;
    version: number;
  };
  entries: Array<{
    id: string;
    authorKey: string;
    authorKind: ReviewEntry['authorKind'];
    authorChildId: string | null;
    prompt: ReviewEntry['prompt'];
    text: string;
    version: number;
  }>;
  summary: WeeklySummary | null;
  schedule: { weekStart: string; weekEnd: string; reviewOn: string; timezone: string };
  presentation: 'ILLUSTRATED' | 'CARD' | 'REFLECTION';
};
export function reviewToDto(raw: {
  review: WeeklyReview | null;
  entries: ReviewEntry[];
  summary: WeeklySummary | null;
  schedule: { weekStart: string; weekEnd: string; reviewOn: string; timezone: string };
  presentation: 'ILLUSTRATED' | 'CARD' | 'REFLECTION';
}): WeeklyReviewView {
  return {
    review: raw.review
      ? {
          id: raw.review.id,
          weekStart: raw.review.weekStart,
          weekEnd: raw.review.weekEnd,
          reviewOn: raw.review.reviewOn,
          status: raw.review.status,
          nextFocus: raw.review.nextFocus,
          version: raw.review.version,
        }
      : null,
    entries: raw.entries.map((e) => ({
      id: e.id,
      authorKey: e.authorKey,
      authorKind: e.authorKind,
      authorChildId: e.authorChildId,
      prompt: e.prompt,
      text: e.text,
      version: e.version,
    })),
    summary: raw.summary,
    schedule: raw.schedule,
    presentation: raw.presentation,
  };
}
