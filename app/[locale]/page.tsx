import { Button, Card } from '@life-os/design-system';
import { notFound } from 'next/navigation';
import { getMessages, isLocale } from '@/src/i18n/messages';

export default async function FoundationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const messages = getMessages(locale);

  return (
    <main className="lo-app-foundation">
      <section className="lo-app-foundation__hero" aria-labelledby="foundation-title">
        <span className="lo-app-foundation__eyebrow">{messages.eyebrow}</span>
        <h1 id="foundation-title">{messages.title}</h1>
        <p>{messages.description}</p>
      </section>

      <Card className="lo-app-foundation__card" variant="soft">
        <strong>{messages.designSystemTitle}</strong>
        <p>{messages.designSystemBody}</p>
        <Button>{messages.smokeAction}</Button>
      </Card>

      <p className="lo-app-foundation__note">{messages.epicNote}</p>
    </main>
  );
}
