'use client';

import { Button, Card } from '@life-os/design-system';
import { useState } from 'react';

export function GuardianSignInForm({ locale }: { locale: string }) {
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
      setError('Sign-in failed.');
      return;
    }

    const bootstrap = await fetch('/api/v1/bootstrap', { cache: 'no-store' });
    const data = (await bootstrap.json()) as { actor: unknown };
    window.location.assign(data.actor ? `/${locale}` : `/${locale}/onboarding`);
  }

  return (
    <Card className="lo-profile-switcher__panel" variant="soft">
      <form className="lo-identity-form" onSubmit={(event) => void submit(event)}>
        <label>
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <Button type="submit">Sign in</Button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </Card>
  );
}
