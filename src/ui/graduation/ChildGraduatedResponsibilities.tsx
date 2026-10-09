import { Card } from '@life-os/design-system';
import type { ActivityMessages } from '@/src/i18n/activity-messages';

export function ChildGraduatedResponsibilities({
  items,
  messages,
}: {
  items: Array<{ id: string; title: string; templateKey: string | null; graduatedAt: string }>;
  messages: ActivityMessages;
}) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="self-managed-title">
      <h2 id="self-managed-title">{messages.selfManagedTitle}</h2>
      <p>{messages.selfManagedIntro}</p>
      {items.map((item) => (
        <Card key={item.id} className="lo-app-foundation__card" variant="soft">
          <strong>
            ✨ {item.templateKey === 'SELF_MAKE_BED' ? messages.makeBedTitle : item.title}
          </strong>
          <p>{messages.graduationCelebration}</p>
        </Card>
      ))}
    </section>
  );
}
