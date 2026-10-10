'use client';

import { Button, Card } from '@life-os/design-system';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { v7 as uuidv7 } from 'uuid';
import type { MoneyMessages } from '@/src/i18n/money-messages';
import { currencyDecimals, displayMoney, suggestedSplit, toMinorUnits } from './money-format';

export interface UiJob {
  id: string;
  childId: string;
  title: string;
  criteria: string;
  paymentMinor: string;
  currency: string;
  status: keyof Pick<
    MoneyMessages,
    | 'OFFERED'
    | 'ACCEPTED'
    | 'IN_PROGRESS'
    | 'SUBMITTED'
    | 'NEEDS_REVISION'
    | 'APPROVED'
    | 'AWAITING_CREDIT'
    | 'CREDITED'
    | 'CANCELLED'
    | 'CANCELLED_WITH_WORK'
  >;
  termsVersion: number;
  acceptedTermsVersion: number | null;
  version: number;
}
export interface UiWallet {
  childId: string;
  currency: string;
  balances: { unallocated: string; give: string; save: string; spend: string };
  savingGoals: Array<{
    id: string;
    title: string;
    targetMinor: string;
    allocatedMinor: string;
    status: 'ACTIVE' | 'CLOSED';
    version: number;
  }>;
  transactions: Array<{
    id: string;
    kind: string;
    note: string;
    occurredAt: string;
    correctionOf: string | null;
    postings: Array<{ bucket: string; amountMinor: string }>;
  }>;
}
export interface MoneyChild {
  id: string;
  displayName: string;
  jobs: UiJob[];
  wallet: UiWallet;
}

function major(minor: string, currency: string) {
  const precision = currencyDecimals(currency);
  const amount = BigInt(minor);
  const div = 10n ** BigInt(precision);
  return amount / div + (precision ? '.' + (amount % div).toString().padStart(precision, '0') : '');
}

export function MoneyPanel({
  mode,
  profiles,
  messages,
}: {
  mode: 'CHILD' | 'GUARDIAN';
  profiles: MoneyChild[];
  messages: MoneyMessages;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardian = mode === 'GUARDIAN';

  async function send(
    type: string,
    payload: Record<string, unknown>,
    version?: {
      resourceType: string;
      resourceId: string;
      version: number;
    },
  ) {
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
          ...(version ? { expectedVersions: [version] } : {}),
          payload,
        }),
      });
      if (!response.ok) throw new Error('Request failed');
      router.refresh();
    } catch {
      setError(messages.error);
    } finally {
      setBusy(false);
    }
  }
  function formMoney(raw: FormData, key: string, currency: string) {
    return toMinorUnits(String(raw.get(key) ?? ''), currency);
  }
  function submitForm(event: FormEvent<HTMLFormElement>, handler: (values: FormData) => void) {
    event.preventDefault();
    try {
      handler(new FormData(event.currentTarget));
    } catch {
      setError(messages.error);
    }
  }
  function jobVersion(job: UiJob) {
    return { resourceType: 'Job', resourceId: job.id, version: job.version };
  }
  function amountField(name: string, label: string, defaultValue = '', required = true) {
    return (
      <label>
        {label}{' '}
        <input
          name={name}
          type="text"
          inputMode="decimal"
          pattern="[0-9]+(\\.[0-9]+)?"
          required={required}
          defaultValue={defaultValue}
          placeholder="10.00"
        />
      </label>
    );
  }
  function renderJob(job: UiJob) {
    const child = profiles.find((c) => c.id === job.childId);
    const canRevise = ['OFFERED', 'ACCEPTED', 'NEEDS_REVISION'].includes(job.status);
    return (
      <Card key={job.id} className="lo-app-foundation__card" variant="soft">
        <h4>{job.title}</h4>
        {guardian && <p>{child?.displayName}</p>}
        <p>{job.criteria}</p>
        <p>
          {messages.pay}: {displayMoney(job.paymentMinor, job.currency, 'en')}
        </p>
        <p>
          {messages.terms}: {job.termsVersion} · {messages[job.status]}
        </p>
        {!guardian && job.status === 'OFFERED' && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void send('AcceptJob', { jobId: job.id }, jobVersion(job))}
          >
            {messages.accept}
          </Button>
        )}
        {!guardian && job.status === 'ACCEPTED' && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void send('StartJob', { jobId: job.id }, jobVersion(job))}
          >
            {messages.start}
          </Button>
        )}
        {!guardian && ['ACCEPTED', 'IN_PROGRESS'].includes(job.status) && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void send('SubmitJob', { jobId: job.id }, jobVersion(job))}
          >
            {messages.submit}
          </Button>
        )}
        {!guardian && job.status === 'NEEDS_REVISION' && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void send('RestartJob', { jobId: job.id }, jobVersion(job))}
          >
            {messages.restart}
          </Button>
        )}
        {guardian && job.status === 'SUBMITTED' && (
          <>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void send('ApproveJob', { jobId: job.id }, jobVersion(job))}
            >
              {messages.approve}
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void send('RequestJobRevision', { jobId: job.id }, jobVersion(job))}
            >
              {messages.requestRevision}
            </Button>
          </>
        )}
        {guardian && job.status === 'AWAITING_CREDIT' && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void send('CreditApprovedJob', { jobId: job.id }, jobVersion(job))}
          >
            {messages.credit}
          </Button>
        )}
        {guardian && canRevise && (
          <form
            onSubmit={(event) =>
              submitForm(event, (form) => {
                void send(
                  'ReviseJobTerms',
                  {
                    jobId: job.id,
                    criteria: String(form.get('criteria')).trim(),
                    paymentMinor: formMoney(form, 'payment', job.currency),
                    reason: String(form.get('reason')).trim(),
                  },
                  jobVersion(job),
                );
              })
            }
          >
            <h5>{messages.revise}</h5>
            <label>
              {messages.jobCriteria}
              <input
                name="criteria"
                required
                minLength={5}
                maxLength={500}
                defaultValue={job.criteria}
              />
            </label>
            {amountField('payment', messages.pay, major(job.paymentMinor, job.currency))}
            <label>
              {messages.revisionReason}
              <input name="reason" required minLength={5} maxLength={400} />
            </label>
            <Button type="submit" disabled={busy}>
              {messages.saveRevision}
            </Button>
          </form>
        )}
        {guardian &&
          ['OFFERED', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED', 'NEEDS_REVISION'].includes(
            job.status,
          ) && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => void send('CancelJob', { jobId: job.id }, jobVersion(job))}
            >
              {messages.cancel}
            </Button>
          )}
      </Card>
    );
  }
  function renderWallet(data: MoneyChild) {
    const wallet = data.wallet;
    const { currency, balances } = wallet;
    const split = suggestedSplit(balances.unallocated);
    const corrected = new Set(wallet.transactions.map((t) => t.correctionOf).filter(Boolean));
    return (
      <Card key={data.id} className="lo-app-foundation__card" variant="soft">
        {guardian && <h4>{data.displayName}</h4>}
        <ul>
          <li>
            <strong>{messages.unallocated}:</strong>{' '}
            {displayMoney(balances.unallocated, currency, 'en')}
          </li>
          <li>
            <strong>{messages.give}:</strong> {displayMoney(balances.give, currency, 'en')}
          </li>
          <li>
            <strong>{messages.save}:</strong> {displayMoney(balances.save, currency, 'en')}
          </li>
          <li>
            <strong>{messages.spend}:</strong> {displayMoney(balances.spend, currency, 'en')}
          </li>
        </ul>
        {guardian && (
          <form
            onSubmit={(event) =>
              submitForm(event, (form) => {
                const type = String(form.get('source'));
                void send(type, {
                  childId: data.id,
                  amountMinor: formMoney(form, 'amount', currency),
                  note: String(form.get('note')).trim(),
                });
              })
            }
          >
            <h5>{messages.recordIncome}</h5>
            <label>
              {messages.source}
              <select name="source">
                <option value="RecordGiftIncome">{messages.gift}</option>
                <option value="RecordAllowanceIncome">{messages.allowance}</option>
              </select>
            </label>
            {amountField('amount', messages.amount)}
            <label>
              {messages.note}
              <input name="note" required minLength={2} maxLength={200} />
            </label>
            <Button type="submit" disabled={busy}>
              {messages.record}
            </Button>
          </form>
        )}
        {guardian && BigInt(balances.unallocated) > 0n && (
          <form
            key={'allocation-' + data.id + '-' + balances.unallocated}
            onSubmit={(event) =>
              submitForm(event, (form) => {
                void send('AllocateMoney', {
                  childId: data.id,
                  giveMinor: formMoney(form, 'give', currency),
                  saveMinor: formMoney(form, 'save', currency),
                  spendMinor: formMoney(form, 'spend', currency),
                });
              })
            }
          >
            <h5>{messages.allocationTitle}</h5>
            <p>{messages.allocationHint}</p>
            {amountField('give', messages.give, major(split.giveMinor, currency))}
            {amountField('save', messages.save, major(split.saveMinor, currency))}
            {amountField('spend', messages.spend, major(split.spendMinor, currency))}
            <Button type="submit" disabled={busy}>
              {messages.allocate}
            </Button>
          </form>
        )}
        {guardian && (
          <form
            onSubmit={(event) =>
              submitForm(event, (form) => {
                const type = String(form.get('outbound'));
                void send(type, {
                  childId: data.id,
                  amountMinor: formMoney(form, 'amount', currency),
                  note: String(form.get('note')).trim(),
                });
              })
            }
          >
            <h5>{messages.outbound}</h5>
            <label>
              {messages.outboundType}
              <select name="outbound">
                <option value="RecordGiving">{messages.give}</option>
                <option value="RecordSpend">{messages.spend}</option>
              </select>
            </label>
            {amountField('amount', messages.amount)}
            <label>
              {messages.note}
              <input name="note" required minLength={2} maxLength={200} />
            </label>
            <Button type="submit" disabled={busy}>
              {messages.recordOutgoing}
            </Button>
          </form>
        )}
        <h5>{messages.savingGoals}</h5>
        {guardian && (
          <form
            onSubmit={(event) =>
              submitForm(event, (form) => {
                void send('CreateSavingGoal', {
                  childId: data.id,
                  title: String(form.get('title')).trim(),
                  targetMinor: formMoney(form, 'target', currency),
                });
              })
            }
          >
            <label>
              {messages.savingGoalTitle}
              <input name="title" required minLength={2} maxLength={140} />
            </label>
            {amountField('target', messages.savingGoalTarget)}
            <Button type="submit" disabled={busy}>
              {messages.createSavingGoal}
            </Button>
          </form>
        )}
        {wallet.savingGoals.map((goal) => (
          <section key={goal.id}>
            <strong>{goal.title}</strong> · {displayMoney(goal.allocatedMinor, currency, 'en')} /{' '}
            {displayMoney(goal.targetMinor, currency, 'en')}
            {goal.status === 'ACTIVE' && guardian && (
              <form
                onSubmit={(event) =>
                  submitForm(event, (form) => {
                    void send('AllocateToSavingGoal', {
                      savingGoalId: goal.id,
                      amountMinor: formMoney(form, 'amount', currency),
                    });
                  })
                }
              >
                {amountField('amount', messages.earmark)}
                <Button type="submit" disabled={busy}>
                  {messages.earmarkAction}
                </Button>
              </form>
            )}
            {goal.status === 'ACTIVE' && guardian && (
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void send(
                    'CloseSavingGoal',
                    { savingGoalId: goal.id },
                    { resourceType: 'SavingGoal', resourceId: goal.id, version: goal.version },
                  )
                }
              >
                {messages.closeSavingGoal}
              </Button>
            )}
          </section>
        ))}
        <h5>{messages.recent}</h5>
        {wallet.transactions.length === 0 && <p>{messages.emptyWallet}</p>}
        <ul>
          {wallet.transactions
            .slice(-15)
            .reverse()
            .map((tx) => (
              <li key={tx.id}>
                <strong>{tx.kind}</strong> — {tx.note} ·{' '}
                {tx.postings.map((p) => p.bucket + ' ' + p.amountMinor).join(', ')}
                {guardian && tx.kind !== 'CORRECTION' && !corrected.has(tx.id) && (
                  <form
                    onSubmit={(event) =>
                      submitForm(
                        event,
                        (form) =>
                          void send('CorrectMoneyTransaction', {
                            transactionId: tx.id,
                            reason: String(form.get('reason')).trim(),
                          }),
                      )
                    }
                  >
                    <label>
                      {messages.correctionReason}
                      <input name="reason" required minLength={5} maxLength={400} />
                    </label>
                    <Button type="submit" disabled={busy}>
                      {messages.correct}
                    </Button>
                  </form>
                )}
              </li>
            ))}
        </ul>
      </Card>
    );
  }
  return (
    <section aria-labelledby="money-title">
      <h2 id="money-title">{messages.title}</h2>
      <p>{messages.intro}</p>
      <p>{messages.online}</p>
      {error && <p role="alert">{error}</p>}
      {guardian && (
        <Card className="lo-app-foundation__card" variant="soft">
          <h3>{messages.offerJob}</h3>
          <form
            onSubmit={(event) =>
              submitForm(event, (form) => {
                const childId = String(form.get('childId'));
                const wallet = profiles.find((c) => c.id === childId)?.wallet;
                if (!wallet) throw new Error('Child not found');
                void send('CreateJob', {
                  childId,
                  title: String(form.get('title')).trim(),
                  criteria: String(form.get('criteria')).trim(),
                  paymentMinor: formMoney(form, 'payment', wallet.currency),
                });
              })
            }
          >
            <label>
              {messages.child}
              <select name="childId">
                {profiles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {messages.jobTitle}
              <input name="title" required minLength={2} maxLength={140} />
            </label>
            <label>
              {messages.jobCriteria}
              <input name="criteria" required minLength={5} maxLength={500} />
            </label>
            {amountField('payment', messages.pay)}
            <Button type="submit" disabled={busy || profiles.length === 0}>
              {messages.jobOffer}
            </Button>
          </form>
        </Card>
      )}
      <h3>{guardian ? messages.familyJobs : messages.myJobs}</h3>
      {profiles.flatMap((c) => c.jobs).length === 0 ? (
        <p>{messages.noJobs}</p>
      ) : (
        profiles.flatMap((c) => c.jobs).map(renderJob)
      )}
      <h3>{guardian ? messages.familyWallet : messages.wallet}</h3>
      {profiles.map(renderWallet)}
    </section>
  );
}
