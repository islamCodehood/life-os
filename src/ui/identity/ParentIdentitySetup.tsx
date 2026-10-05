'use client';

import { Button, Card } from '@life-os/design-system';
import { useRouter } from 'next/navigation';
import { v7 as uuidv7 } from 'uuid';
import { useMemo, useState } from 'react';
import type { IdentityMessages } from '@/src/i18n/identity-messages';

type ChildOption = { id: string; displayName: string };

async function command(type: string, payload: unknown) {
  return fetch('/api/v1/commands', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      commandId: uuidv7(),
      schemaVersion: 1,
      type,
      occurredAt: new Date().toISOString(),
      payload,
    }),
  });
}

export function ParentIdentitySetup({
  childProfiles,
  messages,
}: {
  childProfiles: ChildOption[];
  messages: IdentityMessages;
}) {
  const router = useRouter();
  const [childName, setChildName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');
  const [selectedChildId, setSelectedChildId] = useState(childProfiles[0]?.id ?? '');
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const canSetPin = useMemo(() => Boolean(selectedChildId && pin), [selectedChildId, pin]);

  async function run(action: () => Promise<Response>, after?: () => void) {
    setStatus(null);
    const response = await action();
    if (!response.ok) {
      const body = (await response.json()) as { error?: { message?: string } };
      setStatus(body.error?.message ?? messages.setupFailed);
      return;
    }
    after?.();
    setStatus(messages.setupSaved);
    router.refresh();
  }

  return (
    <div className="lo-identity-admin">
      <Card className="lo-profile-switcher__panel">
        <strong>{messages.addChild}</strong>
        <label>
          <span>{messages.childName}</span>
          <input value={childName} onChange={(event) => setChildName(event.target.value)} />
        </label>
        <label>
          <span>{messages.birthDate}</span>
          <input
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </label>
        <Button
          disabled={!childName.trim() || !birthDate}
          onClick={() =>
            void run(
              () => command('CreateChildProfile', { displayName: childName, birthDate }),
              () => {
                setChildName('');
                setBirthDate('');
              },
            )
          }
        >
          {messages.createChild}
        </Button>
      </Card>

      <Card className="lo-profile-switcher__panel">
        <strong>{messages.enrollDevice}</strong>
        <label>
          <span>{messages.deviceLabel}</span>
          <input value={deviceLabel} onChange={(event) => setDeviceLabel(event.target.value)} />
        </label>
        <Button
          disabled={!deviceLabel.trim()}
          onClick={() =>
            void run(
              () => command('RegisterHouseholdDevice', { label: deviceLabel }),
              () => setDeviceLabel(''),
            )
          }
        >
          {messages.enroll}
        </Button>
      </Card>

      <Card className="lo-profile-switcher__panel">
        <strong>{messages.setPin}</strong>
        <label>
          <span>{messages.chooseChild}</span>
          <select
            value={selectedChildId}
            onChange={(event) => setSelectedChildId(event.target.value)}
          >
            <option value="">{messages.chooseChild}</option>
            {childProfiles.map((child) => (
              <option key={child.id} value={child.id}>
                {child.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{messages.pin}</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
          />
        </label>
        <Button
          disabled={!canSetPin}
          onClick={() =>
            void run(
              () => command('SetChildPin', { childId: selectedChildId, pin }),
              () => setPin(''),
            )
          }
        >
          {messages.savePin}
        </Button>
      </Card>

      {status ? <p role="status">{status}</p> : null}
    </div>
  );
}
