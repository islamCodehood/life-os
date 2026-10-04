import { NextResponse } from 'next/server';
import { currentDateInTimezone } from '@/src/application/identity/current-date';
import { authCookieNames, parseCookieHeader } from '@/src/infrastructure/auth/cookies';
import { createIdentityRuntime } from '@/src/infrastructure/composition/identity-runtime';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';

export async function GET(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));

  try {
    const runtime = await createIdentityRuntime();
    const cookieMap = parseCookieHeader(request.headers.get('cookie'));
    const actor = await runtime.actorResolver.resolve(request);

    let deviceId: string | null = null;
    let switcherProfiles: Awaited<ReturnType<typeof runtime.repository.listChildSummaries>> = [];
    const rawDeviceToken = cookieMap.get(authCookieNames.householdDevice);

    if (rawDeviceToken) {
      const device = await runtime.repository.findTrustedDeviceByTokenHash(
        runtime.tokens.hash(rawDeviceToken, 'device'),
      );
      if (device) {
        deviceId = device.id;
        const family = await runtime.repository.getFamily(device.familyId);
        if (family) {
          switcherProfiles = await runtime.repository.listChildSummaries(
            device.familyId,
            currentDateInTimezone(family.timezone),
          );
        }
      }
    }

    if (!actor || actor.kind === 'SYSTEM') {
      return NextResponse.json(
        { actor: null, deviceId, profiles: switcherProfiles },
        { headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } },
      );
    }

    const family = await runtime.repository.getFamily(actor.familyId);
    if (!family) {
      return NextResponse.json(
        { actor: null, deviceId, profiles: switcherProfiles },
        { headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } },
      );
    }

    const asOfDate = currentDateInTimezone(family.timezone);
    let profiles: typeof switcherProfiles;

    if (actor.kind === 'GUARDIAN') {
      profiles = await runtime.repository.listChildSummaries(actor.familyId, asOfDate);
    } else {
      profiles =
        switcherProfiles.length > 0
          ? switcherProfiles
          : (await runtime.repository.listChildSummaries(actor.familyId, asOfDate)).filter(
              (profile) => profile.id === actor.childId,
            );
    }

    return NextResponse.json(
      {
        actor,
        family: {
          id: family.id,
          name: family.name,
          timezone: family.timezone,
          currency: family.currency,
        },
        deviceId,
        profiles,
      },
      { headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
