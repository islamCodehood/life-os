'use client';
import { Button, Card } from '@life-os/design-system';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { valueTags, type MomentPrivacy, type ValueTag } from '@/src/domain/moments/moment';
import type { StoryMessages } from '@/src/i18n/story-messages';
export type UiMoment = {
  id: string;
  title: string;
  description: string;
  privacy: MomentPrivacy;
  subjectChildId: string | null;
  tags: ValueTag[];
  occurredAt: string;
  status: 'PUBLISHED' | 'ARCHIVED';
  version: number;
};
export type UiAudit = {
  action: 'RECORDED' | 'UPDATED' | 'ARCHIVED';
  version: number;
  editedAt: string;
  reason: string | null;
  before: { title: string; description: string } | null;
  after: { title: string; description: string };
};
const blank = {
  subjectChildId: '' as string,
  privacy: 'CHILD_SAFE' as MomentPrivacy,
  title: '',
  description: '',
  tags: [] as ValueTag[],
  momentOccurredAt: '',
};
export function ParentMomentsPanel({
  items,
  childrenList,
  audit,
  messages,
}: {
  items: UiMoment[];
  childrenList: { id: string; displayName: string }[];
  audit: Record<string, UiAudit[]>;
  messages: StoryMessages;
}) {
  const router = useRouter(),
    [form, setForm] = useState(blank),
    [editing, setEditing] = useState<UiMoment | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [reason, setReason] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  function fromItem(item: UiMoment) {
    setEditing(item);
    setReason('');
    setForm({
      subjectChildId: item.subjectChildId ?? '',
      privacy: item.privacy,
      title: item.title,
      description: item.description,
      tags: [...item.tags],
      momentOccurredAt: item.occurredAt.slice(0, 16),
    });
  }
  async function send(type: string, payload: Record<string, unknown>, current?: UiMoment) {
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
          ...(current
            ? {
                expectedVersions: [
                  { resourceType: 'Moment', resourceId: current.id, version: current.version },
                ],
              }
            : {}),
          payload,
        }),
      });
      if (!response.ok) throw new Error('Moment command rejected');
      setEditing(null);
      setReason('');
      setForm(blank);
      router.refresh();
    } catch {
      setError(messages.error);
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      subjectChildId: form.privacy === 'FAMILY_SHARED' ? null : form.subjectChildId,
      privacy: form.privacy,
      title: form.title.trim(),
      description: form.description.trim(),
      tags: form.tags,
      momentOccurredAt: new Date(form.momentOccurredAt).toISOString(),
    };
    if (editing) {
      void send(
        'UpdateMoment',
        { ...payload, momentId: editing.id, reason: reason.trim() },
        editing,
      );
    } else void send('RecordMoment', payload);
  }
  function subjectVisible(privacy: MomentPrivacy) {
    return privacy !== 'FAMILY_SHARED';
  }
  return (
    <section aria-labelledby="moment-manage-title">
      <h2 id="moment-manage-title">{messages.capture}</h2>
      <p>{messages.guardianNote}</p>
      <p>{messages.online}</p>
      {error && <p role="alert">{error}</p>}
      <Card variant="soft" className="lo-app-foundation__card">
        <form onSubmit={submit}>
          <label>
            {messages.visibility}
            <select
              value={form.privacy}
              onChange={(event) =>
                setForm((v) => ({
                  ...v,
                  privacy: event.target.value as MomentPrivacy,
                  subjectChildId:
                    event.target.value === 'FAMILY_SHARED'
                      ? ''
                      : v.subjectChildId || childrenList[0]?.id || '',
                }))
              }
            >
              <option value="CHILD_SAFE">{messages.childSafe}</option>
              <option value="FAMILY_SHARED">{messages.shared}</option>
              <option value="GUARDIAN_PRIVATE">{messages.private}</option>
            </select>
          </label>
          {subjectVisible(form.privacy) && (
            <label>
              {messages.subject}
              <select
                required
                value={form.subjectChildId}
                onChange={(event) => setForm((v) => ({ ...v, subjectChildId: event.target.value }))}
              >
                <option value="" disabled>
                  —
                </option>
                {childrenList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {messages.title}
            <input
              required
              minLength={2}
              maxLength={140}
              value={form.title}
              onChange={(event) => setForm((v) => ({ ...v, title: event.target.value }))}
            />
          </label>
          <label>
            {messages.description}
            <textarea
              required
              minLength={2}
              maxLength={1000}
              value={form.description}
              onChange={(event) => setForm((v) => ({ ...v, description: event.target.value }))}
            />
          </label>
          <label>
            {messages.happened}
            <input
              type="datetime-local"
              required
              value={form.momentOccurredAt}
              onChange={(event) => setForm((v) => ({ ...v, momentOccurredAt: event.target.value }))}
            />
          </label>
          <fieldset>
            <legend>{messages.chooseTags}</legend>
            {valueTags.map((tag) => (
              <label key={tag}>
                <input
                  type="checkbox"
                  checked={form.tags.includes(tag)}
                  disabled={!form.tags.includes(tag) && form.tags.length >= 5}
                  onChange={(event) =>
                    setForm((v) => ({
                      ...v,
                      tags: event.target.checked
                        ? [...v.tags, tag]
                        : v.tags.filter((t) => t !== tag),
                    }))
                  }
                />
                {messages.values[tag]}
              </label>
            ))}
          </fieldset>
          {editing && (
            <label>
              {messages.reason}
              <input
                required
                minLength={4}
                maxLength={250}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          )}
          <Button
            type="submit"
            disabled={busy || (form.privacy !== 'FAMILY_SHARED' && !form.subjectChildId)}
          >
            {busy ? messages.pending : editing ? messages.saveEdit : messages.publish}
          </Button>
          {editing && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setForm(blank);
              }}
            >
              Cancel
            </Button>
          )}
        </form>
      </Card>
      <h3>{messages.history}</h3>
      {items.map((item) => (
        <Card key={item.id} className="lo-app-foundation__card" variant="soft">
          <h4>{item.title}</h4>
          <p>{item.description}</p>
          <p>
            {item.status === 'ARCHIVED'
              ? messages.archived
              : item.privacy === 'FAMILY_SHARED'
                ? messages.shared
                : item.privacy === 'GUARDIAN_PRIVATE'
                  ? messages.private
                  : messages.childSafe}{' '}
            · {messages.version} {item.version}
          </p>
          {item.status === 'PUBLISHED' && (
            <Button type="button" disabled={busy} onClick={() => fromItem(item)}>
              {messages.edit}
            </Button>
          )}
          {item.status === 'PUBLISHED' && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const fields = new FormData(event.currentTarget);
                void send(
                  'ArchiveMoment',
                  { momentId: item.id, reason: String(fields.get('reason')).trim() },
                  item,
                );
              }}
            >
              <label>
                {messages.reason}
                <input name="reason" required minLength={4} maxLength={250} />
              </label>
              <Button type="submit" disabled={busy}>
                {messages.archive}
              </Button>
            </form>
          )}
          <Button
            type="button"
            disabled={busy}
            onClick={() => setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }))}
          >
            {messages.revision}
          </Button>
          {expanded[item.id] && (
            <ol>
              {(audit[item.id] ?? []).map((entry) => (
                <li key={entry.version}>
                  {messages.version} {entry.version}:{' '}
                  {entry.action === 'RECORDED'
                    ? messages.recorded
                    : entry.action === 'UPDATED'
                      ? messages.updated
                      : messages.archivedAction}
                  {entry.reason && (
                    <p>
                      {messages.reason}: {entry.reason}
                    </p>
                  )}
                  {entry.before && (
                    <p>
                      {entry.before.title}: {entry.before.description}
                    </p>
                  )}
                  <p>
                    {entry.after.title}: {entry.after.description}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      ))}
    </section>
  );
}
