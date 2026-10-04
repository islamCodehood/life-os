import { GuardianSignInForm } from '@/src/ui/identity/GuardianSignInForm';

export default async function GuardianSignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <main className="lo-app-foundation">
      <section className="lo-app-foundation__hero">
        <span className="lo-app-foundation__eyebrow">Guardian</span>
        <h1>Sign in</h1>
        <p>Parent access is separate from child profile access.</p>
      </section>
      <GuardianSignInForm locale={locale} />
    </main>
  );
}
