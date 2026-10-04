import { FamilyOnboardingForm } from '@/src/ui/identity/FamilyOnboardingForm';

export default async function FamilyOnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <main className="lo-app-foundation">
      <section className="lo-app-foundation__hero">
        <span className="lo-app-foundation__eyebrow">Family setup</span>
        <h1>Create your family</h1>
        <p>Identity comes first. Activities and rewards are not part of this setup.</p>
      </section>
      <FamilyOnboardingForm locale={locale} />
    </main>
  );
}
