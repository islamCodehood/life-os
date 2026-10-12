import type {
  WeeklyReview,
  ReviewEntry,
  ReviewPrompt,
  ReviewStatus,
  WeeklySummary,
} from '@/src/domain/weekly-review/review';
export interface ReviewRepository {
  create(review: WeeklyReview): Promise<WeeklyReview>;
  get(familyId: string, id: string): Promise<WeeklyReview | null>;
  lock(familyId: string, id: string): Promise<WeeklyReview | null>;
  forWeek(familyId: string, weekStart: string): Promise<WeeklyReview | null>;
  entries(familyId: string, id: string): Promise<ReviewEntry[]>;
  entry(
    familyId: string,
    reviewId: string,
    authorKey: string,
    prompt: ReviewPrompt,
  ): Promise<ReviewEntry | null>;
  insertEntry(entry: ReviewEntry): Promise<boolean>;
  updateEntry(entry: ReviewEntry, expectedVersion: number): Promise<boolean>;
  transition(
    familyId: string,
    id: string,
    expectedVersion: number,
    status: ReviewStatus,
    focus: string | null,
    now: Date,
  ): Promise<WeeklyReview | null>;
  abandonOlder(familyId: string, beforeWeekStart: string, now: Date): Promise<number>;
  summary(
    familyId: string,
    weekStart: string,
    weekEnd: string,
    childId: string | null,
  ): Promise<WeeklySummary>;
  listFamilies(): Promise<Array<{ id: string; timezone: string; weeklyReviewDay: number | null }>>;
}
