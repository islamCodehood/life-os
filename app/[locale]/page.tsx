import { notFound } from 'next/navigation';
import { getIdentityMessages } from '@/src/i18n/identity-messages';
import { isLocale } from '@/src/i18n/locales';
import { ProfileSwitcher } from '@/src/ui/identity/ProfileSwitcher';

export default async function ProfileSwitcherPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getIdentityMessages(locale);

  return (
    <main className="lo-app-foundation">
      <section className="lo-app-foundation__hero" aria-labelledby="profile-switcher-title">
        <span className="lo-app-foundation__eyebrow">Life OS</span>
        <h1 id="profile-switcher-title">{messages.heading}</h1>
        <p>{messages.intro}</p>
      </section>
      <ProfileSwitcher locale={locale} messages={messages} />
    </main>
  );
}
