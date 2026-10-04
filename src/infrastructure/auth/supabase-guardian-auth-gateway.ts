import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  GuardianAuthenticationError,
  type GuardianAuthGateway,
  type GuardianIdentity,
  type SignInInput,
} from '@/src/application/auth/guardian-auth-gateway';
import { publicEnv } from '@/src/infrastructure/env/public';

class SupabaseGuardianAuthGateway implements GuardianAuthGateway {
  constructor(private readonly client: ReturnType<typeof createServerClient>) {}

  async getCurrentGuardian(): Promise<GuardianIdentity | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) return null;

    const email = data.user.email ?? null;
    const displayName =
      typeof data.user.user_metadata?.full_name === 'string'
        ? data.user.user_metadata.full_name
        : (email?.split('@')[0] ?? 'Guardian');

    return {
      providerUserId: data.user.id,
      email,
      displayName,
    };
  }

  async beginSignIn(input: SignInInput): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword(input);
    if (error) throw new GuardianAuthenticationError();
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw new GuardianAuthenticationError('Guardian sign-out failed.');
  }

  async refreshSession(): Promise<void> {
    const { error } = await this.client.auth.refreshSession();
    if (error) throw new GuardianAuthenticationError('Guardian session refresh failed.');
  }
}

class UnconfiguredGuardianAuthGateway implements GuardianAuthGateway {
  async getCurrentGuardian(): Promise<GuardianIdentity | null> {
    return null;
  }
  async beginSignIn(): Promise<void> {
    throw new GuardianAuthenticationError('Guardian authentication is not configured.');
  }
  async signOut(): Promise<void> {}
  async refreshSession(): Promise<void> {
    throw new GuardianAuthenticationError('Guardian authentication is not configured.');
  }
}

export async function createGuardianAuthGateway(): Promise<GuardianAuthGateway> {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return new UnconfiguredGuardianAuthGateway();
  }

  const cookieStore = await cookies();
  const client = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(values) {
          for (const { name, value, options } of values) {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Server Components may be read-only; Route Handlers remain writable.
            }
          }
        },
      },
    },
  );

  return new SupabaseGuardianAuthGateway(client);
}
