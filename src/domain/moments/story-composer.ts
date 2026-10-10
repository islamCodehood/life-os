import type { Moment, StoryBeat, StoryPresentation } from './moment';
import { storyBeatForMoment } from './moment';
import type { AgeProfile, VisualizationProfile } from '../identity/experience';

export const storyBeatKeys = {
  NEW_BEGINNING: 'newBeginning',
  PROGRESS: 'progress',
  MILESTONE: 'milestone',
  RECOVERY: 'recovery',
  GRADUATION: 'graduation',
  FAMILY_CONTRIBUTION: 'familyContribution',
  KINDNESS_MOMENT: 'kindnessMoment',
  GOAL_ACHIEVED: 'goalAchieved',
} as const;
export const visualCues = {
  NEW_BEGINNING: 'sunrise',
  PROGRESS: 'path',
  MILESTONE: 'star',
  RECOVERY: 'sprout',
  GRADUATION: 'bridge',
  FAMILY_CONTRIBUTION: 'family-tree',
  KINDNESS_MOMENT: 'heart',
  GOAL_ACHIEVED: 'peak',
} as const;
export type StoryItem = {
  id: string;
  source: 'MOMENT' | 'GOAL' | 'GRADUATION' | 'PROGRESS';
  beat: StoryBeat;
  translationKey: (typeof storyBeatKeys)[StoryBeat];
  visualCue: string;
  presentation: StoryPresentation;
  title: string;
  description: string | null;
  occurredAt: string;
  isFamily: boolean;
  tags: string[];
};
export function storyPresentation(
  profile: AgeProfile | null,
  visualization: VisualizationProfile | undefined,
): StoryPresentation {
  if (visualization === 'FOCUSED') return 'TIMELINE';
  if (profile === 'EXPLORER' && visualization !== 'BALANCED') return 'ILLUSTRATED';
  if (profile === 'NAVIGATOR' || profile === 'LAUNCH') return 'TIMELINE';
  return 'CARD';
}
export function composeStory(input: {
  moments: Moment[];
  profile: AgeProfile | null;
  visualization?: VisualizationProfile;
  otherBeats?: Array<{
    id: string;
    beat: StoryBeat;
    title: string;
    occurredAt: Date;
    description?: string;
  }>;
}): StoryItem[] {
  const presentation = storyPresentation(input.profile, input.visualization);
  const moments = input.moments.map((m): StoryItem => {
    const beat = storyBeatForMoment(m);
    return {
      id: m.id,
      source: 'MOMENT',
      beat,
      translationKey: storyBeatKeys[beat],
      visualCue: visualCues[beat],
      presentation,
      title: m.title,
      description: m.description,
      occurredAt: m.occurredAt.toISOString(),
      isFamily: m.privacy === 'FAMILY_SHARED',
      tags: [...m.tags],
    };
  });
  const other = (input.otherBeats ?? []).map((b): StoryItem => ({
    id: b.id,
    source:
      b.beat === 'GOAL_ACHIEVED' ? 'GOAL' : b.beat === 'GRADUATION' ? 'GRADUATION' : 'PROGRESS',
    beat: b.beat,
    translationKey: storyBeatKeys[b.beat],
    visualCue: visualCues[b.beat],
    presentation,
    title: b.title,
    description: b.description ?? null,
    occurredAt: b.occurredAt.toISOString(),
    isFamily: false,
    tags: [],
  }));
  return [...moments, ...other].sort(
    (a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id),
  );
}
