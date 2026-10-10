'use client';

import { Button, Card } from '@life-os/design-system';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { v7 as uuidv7 } from 'uuid';
import type { GoalMessages } from '@/src/i18n/goal-messages';
export interface GoalView {
  id: string;
  ownerType: 'CHILD' | 'FAMILY';
  ownerChildId: string | null;
  category: 'PERSONAL' | 'GROWTH' | 'PROJECT' | 'SHARED';
  title: string;
  why: string;
  nextStep: string;
  target: number;
  progress: number;
  targetDate: string | null;
  status: string;
  version: number;
}
export interface GoalHistory {
  entries: Array<{ id: string; amount: number; step: string; occurredAt: string }>;
  revisions: Array<{ id: string; previousTarget: number; newTarget: number; reason: string }>;
  reflections: Array<{ id: string; text: string; createdAt: string }>;
}
export function GoalsPanel({
  goals,
  history,
  childProfiles,
  mode,
  childId,
  messages,
}: {
  goals: GoalView[];
  history: Record<string, GoalHistory>;
  childProfiles: Array<{ id: string; displayName: string }>;
  mode: 'CHILD' | 'GUARDIAN';
  childId?: string;
  messages: GoalMessages;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    ownerType: 'CHILD' as 'CHILD' | 'FAMILY',
    ownerChildId: childId ?? childProfiles[0]?.id ?? '',
    category: 'PERSONAL' as 'PERSONAL' | 'GROWTH' | 'PROJECT',
    title: '',
    why: '',
    nextStep: '',
    target: 5,
    targetDate: '',
  });
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [steps, setSteps] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [reflections, setReflections] = useState<Record<string, string>>({});

  async function send(type: string, payload: Record<string, unknown>, item?: GoalView) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/commands', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          commandId: uuidv7(),
          schemaVersion: 1,
          type,
          occurredAt: new Date().toISOString(),
          ...(item
            ? {
                expectedVersions: [
                  { resourceType: 'Goal', resourceId: item.id, version: item.version },
                ],
              }
            : {}),
          payload,
        }),
      });
      if (!response.ok) throw new Error('Goal command rejected');
      if (type === 'CreateGoal') setForm((prev) => ({ ...prev, title: '', why: '', nextStep: '' }));
      router.refresh();
    } catch {
      setError(messages.failed);
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const shared = mode === 'GUARDIAN' && form.ownerType === 'FAMILY';
    void send('CreateGoal', {
      ownerType: shared ? 'FAMILY' : 'CHILD',
      ownerChildId: shared ? null : mode === 'CHILD' ? childId : form.ownerChildId,
      category: shared ? 'SHARED' : form.category,
      title: form.title.trim(),
      why: form.why.trim(),
      nextStep: form.nextStep.trim(),
      target: form.target,
      targetDate: form.targetDate || null,
    });
  }
  const own = goals.filter((g) => g.ownerType === 'CHILD');
  const shared = goals.filter((g) => g.ownerType === 'FAMILY');
  function renderGoal(item: GoalView) {
    const done = item.status === 'ACHIEVED' || item.status === 'CLOSED';
    const canEdit = mode === 'GUARDIAN';
    const historyItem = history[item.id];
    return (
      <Card key={item.id} variant="soft" className="lo-app-foundation__card">
        <h3>{item.title}</h3>
        <p>{item.why}</p>
        <p>
          {messages.nextStep}: {item.nextStep}
        </p>
        <p>
          {messages.count}: {item.progress} / {item.target} {messages.unit}
        </p>
        <progress
          value={item.progress}
          max={item.target}
          aria-label={item.title + ' ' + messages.count}
        />
        <p>
          {item.status === 'TARGET_DATE_REACHED'
            ? messages.dateReached
            : item.status === 'AWAITING_APPROVAL'
              ? messages.approval
              : item.status === 'ACTIVE'
                ? messages.active
                : item.status === 'PAUSED'
                  ? messages.paused
                  : item.status === 'ACHIEVED'
                    ? messages.achieved
                    : messages.closed}
        </p>
        {item.ownerType === 'FAMILY' && <p>{messages.collective}</p>}
        {item.status === 'AWAITING_APPROVAL' && canEdit && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void send('ApproveGoal', { goalId: item.id }, item)}
          >
            {messages.approve}
          </Button>
        )}
        {(item.status === 'ACTIVE' || item.status === 'TARGET_DATE_REACHED') && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(
                'AddGoalProgress',
                {
                  goalId: item.id,
                  amount: amounts[item.id] ?? 1,
                  step: steps[item.id]?.trim() ?? '',
                },
                item,
              );
            }}
          >
            <label>
              {messages.step}
              <input
                required
                minLength={1}
                maxLength={200}
                value={steps[item.id] ?? ''}
                onChange={(event) => setSteps((s) => ({ ...s, [item.id]: event.target.value }))}
              />
            </label>
            <label>
              {messages.count}
              <input
                required
                type="number"
                min={1}
                max={item.target - item.progress}
                value={amounts[item.id] ?? 1}
                onChange={(event) =>
                  setAmounts((s) => ({ ...s, [item.id]: Number(event.target.value) }))
                }
              />
            </label>
            <Button type="submit" disabled={busy || item.progress >= item.target}>
              {messages.add}
            </Button>
          </form>
        )}
        {canEdit && item.status === 'ACTIVE' && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void send('PauseGoal', { goalId: item.id }, item)}
          >
            {messages.pause}
          </Button>
        )}
        {canEdit && item.status === 'PAUSED' && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void send('ResumeGoal', { goalId: item.id }, item)}
          >
            {messages.resume}
          </Button>
        )}
        {canEdit &&
          (item.status === 'ACTIVE' || item.status === 'TARGET_DATE_REACHED') &&
          item.progress === item.target && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => void send('AchieveGoal', { goalId: item.id }, item)}
            >
              {messages.achieve}
            </Button>
          )}
        {canEdit && !done && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void send('CloseGoal', { goalId: item.id }, item)}
          >
            {messages.close}
          </Button>
        )}
        {canEdit && !done && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(
                'ReviseGoal',
                {
                  goalId: item.id,
                  target: targets[item.id] ?? item.target,
                  targetDate: dates[item.id] ?? item.targetDate,
                  reason: reasons[item.id]?.trim() ?? '',
                },
                item,
              );
            }}
          >
            <h4>{messages.revise}</h4>
            <label>
              {messages.target}
              <input
                type="number"
                required
                min={Math.max(1, item.progress)}
                max={1000000}
                value={targets[item.id] ?? item.target}
                onChange={(event) =>
                  setTargets((v) => ({ ...v, [item.id]: Number(event.target.value) }))
                }
              />
            </label>
            <label>
              {messages.targetDate}
              <input
                type="date"
                value={dates[item.id] ?? item.targetDate ?? ''}
                onChange={(event) => setDates((v) => ({ ...v, [item.id]: event.target.value }))}
              />
            </label>
            <label>
              {messages.reason}
              <input
                required
                minLength={4}
                maxLength={400}
                value={reasons[item.id] ?? ''}
                onChange={(event) => setReasons((v) => ({ ...v, [item.id]: event.target.value }))}
              />
            </label>
            <Button type="submit" disabled={busy}>
              {messages.saveRevision}
            </Button>
          </form>
        )}
        {done && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send('RecordGoalReflection', {
                goalId: item.id,
                text: reflections[item.id]?.trim() ?? '',
              });
            }}
          >
            <label>
              {messages.reflect}
              <input
                required
                minLength={2}
                maxLength={1000}
                value={reflections[item.id] ?? ''}
                onChange={(event) =>
                  setReflections((v) => ({ ...v, [item.id]: event.target.value }))
                }
              />
            </label>
            <Button type="submit" disabled={busy}>
              {messages.saveReflection}
            </Button>
          </form>
        )}
        {!!historyItem?.entries.length && (
          <section>
            <h4>{messages.recentSteps}</h4>
            <ul>
              {historyItem.entries.slice(-4).map((entry) => (
                <li key={entry.id}>
                  {entry.step} (+{entry.amount})
                </li>
              ))}
            </ul>
          </section>
        )}
        {!!historyItem?.reflections.length && (
          <section>
            <h4>{messages.reflections}</h4>
            <ul>
              {historyItem.reflections.slice(-3).map((entry) => (
                <li key={entry.id}>{entry.text}</li>
              ))}
            </ul>
          </section>
        )}
      </Card>
    );
  }
  return (
    <section aria-labelledby="goals-title">
      <h2 id="goals-title">{messages.title}</h2>
      <p>{messages.intro}</p>
      {mode === 'CHILD' && <p>{messages.ownOnly}</p>}
      <p>{messages.online}</p>
      {error && <p role="alert">{error}</p>}
      <Card variant="soft" className="lo-app-foundation__card">
        <form onSubmit={submit}>
          {mode === 'GUARDIAN' && (
            <label>
              {messages.goalType}
              <select
                value={form.ownerType}
                onChange={(e) =>
                  setForm((v) => ({ ...v, ownerType: e.target.value as 'CHILD' | 'FAMILY' }))
                }
              >
                <option value="CHILD">{messages.personal}</option>
                <option value="FAMILY">{messages.shared}</option>
              </select>
            </label>
          )}
          {mode === 'GUARDIAN' && form.ownerType === 'CHILD' && (
            <label>
              {messages.child}
              <select
                value={form.ownerChildId}
                onChange={(e) => setForm((v) => ({ ...v, ownerChildId: e.target.value }))}
              >
                {childProfiles.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.displayName}
                  </option>
                ))}
              </select>
            </label>
          )}
          {form.ownerType === 'CHILD' && (
            <label>
              {messages.goalType}
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((v) => ({
                    ...v,
                    category: e.target.value as 'PERSONAL' | 'GROWTH' | 'PROJECT',
                  }))
                }
              >
                <option value="PERSONAL">{messages.personal}</option>
                <option value="GROWTH">{messages.growth}</option>
                <option value="PROJECT">{messages.project}</option>
              </select>
            </label>
          )}
          <label>
            {messages.what}
            <input
              required
              maxLength={140}
              value={form.title}
              onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))}
            />
          </label>
          <label>
            {messages.why}
            <input
              required
              maxLength={400}
              value={form.why}
              onChange={(e) => setForm((v) => ({ ...v, why: e.target.value }))}
            />
          </label>
          <label>
            {messages.nextStep}
            <input
              required
              maxLength={200}
              value={form.nextStep}
              onChange={(e) => setForm((v) => ({ ...v, nextStep: e.target.value }))}
            />
          </label>
          <label>
            {messages.target}
            <input
              type="number"
              min={1}
              max={1000000}
              required
              value={form.target}
              onChange={(e) => setForm((v) => ({ ...v, target: Number(e.target.value) }))}
            />
          </label>
          <label>
            {messages.targetDate}
            <input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm((v) => ({ ...v, targetDate: e.target.value }))}
            />
          </label>
          <Button
            type="submit"
            disabled={
              busy || (mode === 'GUARDIAN' && form.ownerType === 'CHILD' && !form.ownerChildId)
            }
          >
            {busy ? messages.loading : mode === 'CHILD' ? messages.propose : messages.create}
          </Button>
        </form>
      </Card>
      <h3>{messages.privateTitle}</h3>
      {own.length ? own.map(renderGoal) : <p>{messages.noGoals}</p>}
      <h3>{messages.sharedTitle}</h3>
      {shared.length ? shared.map(renderGoal) : <p>{messages.noGoals}</p>}
    </section>
  );
}
