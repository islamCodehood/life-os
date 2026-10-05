import { notFound } from 'next/navigation';
import { getIdentityMessages } from '@/src/i18n/identity-messages';
import { isLocale } from '@/src/i18n/locales';
import { FamilyOnboardingForm } from '@/src/ui/identity/FamilyOnboardingForm';

export default async function FamilyOnboardingPage({
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
        <span className="lo-app-foundation__eyebrow">{messages.familySetup}</span>
        <h1>{messages.createFamilyTitle}</h1>
        <p>{messages.createFamilyIntro}</p>
      </section>
      <FamilyOnboardingForm locale={locale} messages={messages} />
    </main>
  );
}
