'use client';

import { Button, Card, ChildAvatar } from '@life-os/design-system';
import { v7 as uuidv7 } from 'uuid';
import { useEffect, useState } from 'react';

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

export function ProfileSwitcher({ locale }: { locale: string }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parentPassword, setParentPassword] = useState('');

  async function reload() {
    const response = await fetch('/api/v1/bootstrap', { cache: 'no-store' });
    if (response.ok) setData((await response.json()) as Bootstrap);
  }

  useEffect(() => {
    void reload();
  }, []);

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
      setError(body.error?.message ?? 'Could not enter child profile.');
      return;
    }
    window.location.assign(`/${locale}/child`);
  }

  async function enterParent() {
    if (data?.actor?.kind === 'GUARDIAN') {
      window.location.assign(`/${locale}/parent`);
      return;
    }

    if (!data?.family?.id || !parentPassword) {
      window.location.assign(`/${locale}/guardian/sign-in`);
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
      setError(body.error?.message ?? 'Parent unlock failed.');
      return;
    }
    window.location.assign(`/${locale}/parent`);
  }

  if (!data) {
    return <p className="lo-app-foundation__note">Loading family profiles…</p>;
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
            <ChildAvatar
              name={profile.displayName}
              seed={profile.id}
              size="lg"
              aria-label={profile.displayName}
            />
            <strong>{profile.displayName}</strong>
            <span>{profile.ageProfile ?? 'Profile'}</span>
          </button>
        ))}
      </div>

      {selected ? (
        <Card className="lo-profile-switcher__panel" variant="soft">
          <strong>Enter {selected.displayName}</strong>
          {data.deviceId ? (
            <>
              <label>
                <span>PIN</span>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                />
              </label>
              <Button onClick={() => void enterChild()}>Enter child profile</Button>
            </>
          ) : (
            <p>This device must be enrolled by a parent first.</p>
          )}
        </Card>
      ) : null}

      <Card className="lo-profile-switcher__panel">
        <strong>Parent</strong>
        {data.actor?.kind === 'CHILD' ? (
          <label>
            <span>Guardian password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={parentPassword}
              onChange={(event) => setParentPassword(event.target.value)}
            />
          </label>
        ) : null}
        <Button onClick={() => void enterParent()}>Open parent mode</Button>
      </Card>

      {error ? <p role="alert">{error}</p> : null}
      <span className="lo-profile-switcher__debug" aria-hidden="true">
        {uuidv7().slice(0, 0)}
      </span>
    </div>
  );
}
