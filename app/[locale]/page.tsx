import { ProfileSwitcher } from '@/src/ui/identity/ProfileSwitcher';

export default async function ProfileSwitcherPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <main className="lo-app-foundation">
      <section className="lo-app-foundation__hero" aria-labelledby="profile-switcher-title">
        <span className="lo-app-foundation__eyebrow">Life OS</span>
        <h1 id="profile-switcher-title">Who is using Life OS?</h1>
        <p>Child profiles are scoped. Parent mode requires guardian authentication.</p>
      </section>
      <ProfileSwitcher locale={locale} />
    </main>
  );
}
