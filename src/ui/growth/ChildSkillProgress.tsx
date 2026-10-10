import { Card } from '@life-os/design-system';
import type { ActivityMessages } from '@/src/i18n/activity-messages';
import type { SkillKey } from '@/src/domain/growth/skill-xp';

export function ChildSkillProgress({
  skills,
  messages,
}: {
  skills: Array<{
    skillKey: SkillKey;
    xp: number;
    achievedMilestones: readonly number[];
    nextMilestone: number | null;
  }>;
  messages: ActivityMessages;
}) {
  return (
    <section aria-labelledby="skills-title">
      <h2 id="skills-title">{messages.skillsTitle}</h2>
      <p>{messages.skillsIntro}</p>
      {skills.map((skill) => (
        <Card key={skill.skillKey} className="lo-app-foundation__card" variant="soft">
          <strong>
            {skill.skillKey === 'READING' ? messages.readingSkill : messages.chessSkill}
          </strong>
          <p>{skill.xp} XP</p>
          <p>
            {skill.nextMilestone === null
              ? messages.allMilestonesReached
              : `${messages.nextMilestone}: ${skill.nextMilestone} XP`}
          </p>
          {skill.achievedMilestones.length > 0 && (
            <p>
              {messages.milestonesReached}: {skill.achievedMilestones.join(', ')}
            </p>
          )}
        </Card>
      ))}
    </section>
  );
}
