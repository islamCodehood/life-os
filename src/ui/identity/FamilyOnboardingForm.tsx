'use client';

import { Button, Card } from '@life-os/design-system';
import { useRouter } from 'next/navigation';
import { v7 as uuidv7 } from 'uuid';
import { useState } from 'react';

export function FamilyOnboardingForm({ locale }: { locale: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('Africa/Cairo');
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
      setError(body.error?.message ?? 'Could not create family.');
      return;
    }
    router.push(`/${locale}/parent`);
    router.refresh();
  }

  return (
    <Card className="lo-profile-switcher__panel" variant="soft">
      <form className="lo-identity-form" onSubmit={(event) => void submit(event)}>
        <label>
          <span>Family name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          <span>Timezone</span>
          <input value={timezone} onChange={(event) => setTimezone(event.target.value)} />
        </label>
        <label>
          <span>Currency</span>
          <input
            value={currency}
            maxLength={3}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          />
        </label>
        <Button type="submit">Create family</Button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </Card>
  );
}
