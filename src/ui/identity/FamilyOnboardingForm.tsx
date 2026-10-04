'use client';

import { Button, Card } from '@life-os/design-system';
import { useRouter } from 'next/navigation';
import { v7 as uuidv7 } from 'uuid';
import { useState } from 'react';
import type { IdentityMessages } from '@/src/i18n/identity-messages';

export function FamilyOnboardingForm({
  locale,
  messages,
}: {
  locale: string;
  messages: IdentityMessages;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  const [currency, setCurrency] = useState('EGP');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/v1/onboarding/family', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        commandId: uuidv7(),
        schemaVersion: 1,
        type: 'CreateFamily',
        occurredAt: new Date().toISOString(),
        payload: { name, timezone, currency },
      }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: { message?: string } };
      setError(body.error?.message ?? messages.createFamilyFailed);
      return;
    }
    router.push(`/${locale}/parent`);
    router.refresh();
  }

  return (
    <Card className="lo-profile-switcher__panel" variant="soft">
      <form className="lo-identity-form" onSubmit={(event) => void submit(event)}>
        <label>
          <span>{messages.familyName}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          <span>{messages.timezone}</span>
          <input value={timezone} onChange={(event) => setTimezone(event.target.value)} />
        </label>
        <label>
          <span>{messages.currency}</span>
          <input
            value={currency}
            maxLength={3}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          />
        </label>
        <Button type="submit">{messages.createFamily}</Button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </Card>
  );
}
