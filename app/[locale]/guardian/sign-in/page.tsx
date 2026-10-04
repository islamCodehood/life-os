import { notFound } from 'next/navigation';
import { getIdentityMessages } from '@/src/i18n/identity-messages';
import { isLocale } from '@/src/i18n/locales';
import { GuardianSignInForm } from '@/src/ui/identity/GuardianSignInForm';

export default async function GuardianSignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getIdentityMessages(locale);

  return (
    <main className="lo-app-foundation">
      <section className="lo-app-foundation__hero">
        <span className="lo-app-foundation__eyebrow">{messages.guardianSignIn}</span>
        <h1>{messages.signInTitle}</h1>
        <p>{messages.signInIntro}</p>
      </section>
      <GuardianSignInForm locale={locale} messages={messages} />
    </main>
  );
}
