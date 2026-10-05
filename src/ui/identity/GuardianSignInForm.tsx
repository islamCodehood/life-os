'use client';

import { Button, Card } from '@life-os/design-system';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { IdentityMessages } from '@/src/i18n/identity-messages';

export function GuardianSignInForm({
  locale,
  messages,
}: {
  locale: string;
  messages: IdentityMessages;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/v1/auth/guardian/sign-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      setError(messages.signInFailed);
      return;
    }

    const bootstrap = await fetch('/api/v1/bootstrap', { cache: 'no-store' });
    const data = (await bootstrap.json()) as { actor: unknown };
    router.push(data.actor ? `/${locale}` : `/${locale}/onboarding`);
    router.refresh();
  }

  return (
    <Card className="lo-profile-switcher__panel" variant="soft">
      <form className="lo-identity-form" onSubmit={(event) => void submit(event)}>
        <label>
          <span>{messages.email}</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          <span>{messages.password}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <Button type="submit">{messages.signIn}</Button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </Card>
  );
}
