export type AgeProfile = 'EXPLORER' | 'BUILDER' | 'NAVIGATOR' | 'LAUNCH';
export type VisualizationProfile = 'IMMERSIVE' | 'BALANCED' | 'FOCUSED';
export type MotionPreference = 'FULL' | 'REDUCED' | 'OFF';

export interface ExperiencePreference {
  visualization: VisualizationProfile;
  motion: MotionPreference;
  themeKey: string;
}

export function ageOnDate(birthDate: string, asOfDate: string): number {
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
  const [year, month, day] = asOfDate.split('-').map(Number);

  if (
    !birthYear ||
    !birthMonth ||
    !birthDay ||
    !year ||
    !month ||
    !day ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)
  ) {
    throw new Error('Dates must use YYYY-MM-DD.');
  }

  let age = year - birthYear;
  if (month < birthMonth || (month === birthMonth && day < birthDay)) {
    age -= 1;
  }

  return age;
}

export function deriveAgeProfile(birthDate: string, asOfDate: string): AgeProfile | null {
  const age = ageOnDate(birthDate, asOfDate);

  if (age >= 6 && age <= 8) return 'EXPLORER';
  if (age >= 9 && age <= 12) return 'BUILDER';
  if (age >= 13 && age <= 15) return 'NAVIGATOR';
  if (age >= 16 && age <= 17) return 'LAUNCH';
  return null;
}

export function recommendedVisualization(profile: AgeProfile): VisualizationProfile {
  switch (profile) {
    case 'EXPLORER':
      return 'IMMERSIVE';
    case 'BUILDER':
      return 'BALANCED';
    case 'NAVIGATOR':
    case 'LAUNCH':
      return 'FOCUSED';
  }
}
