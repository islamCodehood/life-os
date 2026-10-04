export interface GuardianIdentity {
  providerUserId: string;
  email: string | null;
  displayName: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface GuardianAuthGateway {
  getCurrentGuardian(): Promise<GuardianIdentity | null>;
  beginSignIn(input: SignInInput): Promise<void>;
  signOut(): Promise<void>;
  refreshSession(): Promise<void>;
}
