'use client';
import { Button, Card } from '@life-os/design-system';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { prompts, type ReviewPrompt } from '@/src/domain/weekly-review/review';
import type { WeeklyReviewView } from '@/src/application/weekly-review/review-dto';
import type { ReviewMessages } from '@/src/i18n/review-messages';
type Props = {
  mode: 'CHILD' | 'GUARDIAN';
  view: WeeklyReviewView;
  messages: ReviewMessages;
  childId?: string;
  childrenNames?: Array<{ id: string; name: string }>;
};
export function WeeklyReviewPanel({ mode, view, messages, childId, childrenNames = [] }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState(view.review?.nextFocus ?? '');
  const entries = view.entries;
  const ownEntries = entries.filter((e) =>
    mode === 'CHILD' ? e.authorChildId === childId : e.authorKind === 'GUARDIAN',
  );
  const [answers, setAnswers] = useState<Partial<Record<ReviewPrompt, string>>>(() =>
    Object.fromEntries(ownEntries.map((e) => [e.prompt, e.text])),
  );
  const available = view.review?.status === 'OPEN';
  const variants: Record<WeeklyReviewView['presentation'], string> = {
    ILLUSTRATED: 'lo-review--illustrated',
    CARD: 'lo-review--card',
    REFLECTION: 'lo-review--reflection',
  };
  async function command(type: string, payload: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/commands', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          commandId: uuidv7(),
          type,
          schemaVersion: 1,
          occurredAt: new Date().toISOString(),
          payload,
        }),
      });
      if (!response.ok) throw new Error('Review command failed');
      router.refresh();
    } catch {
      setError(messages.error);
    } finally {
      setBusy(false);
    }
  }
  function save(event: FormEvent<HTMLFormElement>, prompt: ReviewPrompt) {
    event.preventDefault();
    if (!view.review) return;
    const before = ownEntries.find((e) => e.prompt === prompt);
    const text = (answers[prompt] ?? '').trim();
    if (!text) return;
    void command('SaveWeeklyReviewEntry', {
      reviewId: view.review.id,
      prompt,
      text,
      expectedEntryVersion: before?.version ?? 0,
    });
  }
  const format = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
  const start = format.format(new Date(view.schedule.weekStart + 'T00:00:00Z'));
  const end = format.format(new Date(view.schedule.weekEnd + 'T00:00:00Z'));
  const summary = view.summary;
  const status = view.review?.status;
  const heading = mode === 'CHILD' ? messages.childTitle : messages.title;
  return (
    <section className={'lo-review ' + variants[view.presentation]} aria-label={heading}>
      <Card variant="soft" className="lo-app-foundation__card">
        <h2>{heading}</h2>
        <p>{mode === 'CHILD' ? messages.childIntro : messages.parentIntro}</p>
        <p>
          <strong>{messages.period}:</strong>{' '}
          <time dateTime={view.schedule.weekStart}>{start}</time> –{' '}
          <time dateTime={view.schedule.weekEnd}>{end}</time>
        </p>
        {error && <p role="alert">{error}</p>}
        {!view.review && <p>{mode === 'CHILD' ? messages.notStarted : messages.noReview}</p>}
        {!view.review && mode === 'GUARDIAN' && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void command('StartWeeklyReview', {})}
          >
            {busy ? messages.saving : messages.start}
          </Button>
        )}
        {status === 'COMPLETED' && <p>{messages.completed}</p>}
        {status === 'SKIPPED' && <p>{messages.skipped}</p>}
        {status === 'ABANDONED' && <p>{messages.abandoned}</p>}
        {status === 'OPEN' && <p>{messages.open}</p>}
        {summary && (
          <>
            <h3>{messages.summary}</h3>
            <dl className="lo-review__facts">
              {(
                [
                  ['responsibilities', summary.completedResponsibilities],
                  ['skills', summary.practisedSkills],
                  ['goals', summary.achievedGoals],
                  ['sharedMoments', summary.sharedMoments],
                  ['personalMoments', summary.personalMoments],
                ] as const
              ).map(([key, count]) => (
                <div key={key}>
                  <dt>{messages[key]}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
            <p>{messages.noFacts}</p>
          </>
        )}
        <p className="lo-review__privacy">
          {mode === 'CHILD' ? messages.childPrivacy : messages.guardianView}
        </p>
      </Card>
      {view.review && (
        <>
          <Card variant="soft" className="lo-app-foundation__card">
            <h3>{messages.yourAnswers}</h3>
            <p>{available ? messages.draftHint : messages.readOnly}</p>
            {prompts.map((prompt, index) => {
              const current = ownEntries.find((e) => e.prompt === prompt);
              return (
                <form
                  key={prompt}
                  onSubmit={(event) => save(event, prompt)}
                  className="lo-review__prompt"
                >
                  <label htmlFor={'review-' + mode + '-' + prompt}>
                    {view.presentation === 'ILLUSTRATED' && (
                      <span aria-hidden="true" className="lo-review__illustration">
                        {['🌟', '🌧️', '📚', '🤝', '🌱', '🧭'][index]}
                      </span>
                    )}
                    {messages.prompts[prompt]}
                  </label>
                  <textarea
                    id={'review-' + mode + '-' + prompt}
                    rows={view.presentation === 'REFLECTION' ? 5 : 3}
                    maxLength={1200}
                    minLength={1}
                    disabled={!available || busy}
                    value={answers[prompt] ?? ''}
                    onChange={(event) =>
                      setAnswers((old) => ({ ...old, [prompt]: event.target.value }))
                    }
                  />
                  {available && (
                    <Button
                      type="submit"
                      disabled={
                        busy ||
                        !(answers[prompt] ?? '').trim() ||
                        (answers[prompt] ?? '').trim() === current?.text
                      }
                    >
                      {busy ? messages.saving : messages.save}
                    </Button>
                  )}
                </form>
              );
            })}
            <p>{messages.offline}</p>
          </Card>
          {mode === 'GUARDIAN' && entries.some((e) => e.authorKind === 'CHILD') && (
            <Card variant="soft" className="lo-app-foundation__card">
              <h3>{messages.familyAnswers}</h3>
              {entries
                .filter((e) => e.authorKind === 'CHILD')
                .map((entry) => (
                  <article key={entry.id} className="lo-review__entry">
                    <strong>
                      {messages.reviewedBy}:{' '}
                      {childrenNames.find((c) => c.id === entry.authorChildId)?.name ?? 'Child'}
                    </strong>
                    <p>{messages.prompts[entry.prompt]}</p>
                    <p>{entry.text}</p>
                  </article>
                ))}
            </Card>
          )}
          {mode === 'GUARDIAN' && (
            <Card variant="soft" className="lo-app-foundation__card">
              <h3>{messages.focus}</h3>
              <textarea
                maxLength={240}
                minLength={3}
                rows={3}
                disabled={!available || busy}
                placeholder={messages.focusPlaceholder}
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
              />
              {available && (
                <div className="lo-review__actions">
                  <Button
                    type="button"
                    disabled={busy || focus.trim().length < 3}
                    onClick={() =>
                      void command('CompleteWeeklyReview', {
                        reviewId: view.review!.id,
                        expectedReviewVersion: view.review!.version,
                        nextFocus: focus.trim(),
                      })
                    }
                  >
                    {messages.finish}
                  </Button>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void command('SkipWeeklyReview', {
                        reviewId: view.review!.id,
                        expectedReviewVersion: view.review!.version,
                      })
                    }
                  >
                    {messages.skip}
                  </Button>
                </div>
              )}
              {!available && view.review.nextFocus && <p>{view.review.nextFocus}</p>}
            </Card>
          )}
        </>
      )}
    </section>
  );
}
