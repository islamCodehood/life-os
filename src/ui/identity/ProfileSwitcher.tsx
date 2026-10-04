'use client';

import { Button, Card, ChildAvatar } from '@life-os/design-system';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { IdentityMessages } from '@/src/i18n/identity-messages';

type Profile = {
  id: string;
  displayName: string;
  avatarKey: string | null;
  ageProfile: string | null;
};

type Bootstrap = {
  actor: null | { kind: 'GUARDIAN' | 'CHILD'; familyId: string; childId?: string };
  family?: { id: string; name: string };
  deviceId: string | null;
  profiles: Profile[];
};

async function loadBootstrap(): Promise<Bootstrap> {
  const response = await fetch('/api/v1/bootstrap', { cache: 'no-store' });
  if (!response.ok) throw new Error('Bootstrap failed.');
  return response.json() as Promise<Bootstrap>;
}

export function ProfileSwitcher({
  locale,
  messages,
}: {
  locale: string;
  messages: IdentityMessages;
}) {
  const router = useRouter();
  const { data, isPending, isError } = useQuery({
    queryKey: ['identity', 'bootstrap'],
    queryFn: loadBootstrap,
    retry: false,
  });
  const [selected, setSelected] = useState<Profile | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parentPassword, setParentPassword] = useState('');

  async function enterChild() {
    if (!selected || !data?.deviceId) return;
    setError(null);
    const response = await fetch('/api/v1/auth/child-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ childId: selected.id, deviceId: data.deviceId, pin }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: { message?: string } };
      setError(body.error?.message ?? messages.couldNotEnterChild);
      return;
    }
    router.push(`/${locale}/child`);
    router.refresh();
  }

  async function enterParent() {
    if (data?.actor?.kind === 'GUARDIAN') {
      router.push(`/${locale}/parent`);
      return;
    }

    if (!data?.family?.id || !parentPassword) {
      router.push(`/${locale}/guardian/sign-in`);
      return;
    }

    setError(null);
    const response = await fetch('/api/v1/auth/parent-unlock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ familyId: data.family.id, password: parentPassword }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: { message?: string } };
      setError(body.error?.message ?? messages.parentUnlockFailed);
      return;
    }
    router.push(`/${locale}/parent`);
    router.refresh();
  }

  if (isPending) {
    return <p className="lo-app-foundation__note">{messages.loadingProfiles}</p>;
  }

  if (isError || !data) {
    return (
      <Card className="lo-profile-switcher__panel" variant="soft">
        <strong>{messages.setupNeeded}</strong>
        <p>{messages.setupNeededBody}</p>
        <Button onClick={() => router.push(`/${locale}/guardian/sign-in`)}>
          {messages.guardianSignIn}
        </Button>
      </Card>
    );
  }

  return (
    <div className="lo-profile-switcher">
      <div className="lo-profile-switcher__grid">
        {data.profiles.map((profile) => (
          <button
            className="lo-profile-switcher__profile"
            key={profile.id}
            type="button"
            onClick={() => {
              setSelected(profile);
              setPin('');
              setError(null);
            }}
          >
            <ChildAvatar name={profile.displayName} size="lg" />
            <strong>{profile.displayName}</strong>
            <span>{profile.ageProfile ?? messages.profile}</span>
          </button>
        ))}
      </div>

      {selected ? (
        <Card className="lo-profile-switcher__panel" variant="soft">
          <strong>
            {messages.enter} {selected.displayName}
          </strong>
          {data.deviceId ? (
            <>
              <label>
                <span>{messages.pin}</span>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                />
              </label>
              <Button onClick={() => void enterChild()}>{messages.enterChildProfile}</Button>
            </>
          ) : (
            <p>{messages.deviceEnrollmentRequired}</p>
          )}
        </Card>
      ) : null}

      <Card className="lo-profile-switcher__panel">
        <strong>{messages.parent}</strong>
        {data.actor?.kind === 'CHILD' ? (
          <label>
            <span>{messages.guardianPassword}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={parentPassword}
              onChange={(event) => setParentPassword(event.target.value)}
            />
          </label>
        ) : null}
        <Button onClick={() => void enterParent()}>{messages.openParentMode}</Button>
      </Card>

      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
