import type { Locale } from './locales';

const messages = {
  en: {
    todayTitle: 'Today',
    responsibilities: 'Responsibilities',
    nothingToday: 'No responsibilities are ready for today yet.',
    makeBedTitle: 'Make your bed',
    makeBedWhy: 'Caring for your own space is part of becoming more independent.',
    whyLabel: 'Why',
    targetPrefix: 'Target',
    notAvailableYet: 'Available later',
    opportunityClosed: 'This opportunity is no longer open.',
    completionFailed: 'Could not record completion. Try again.',
    makeBedSetupTitle: 'Make Bed pilot',
    makeBedSetupIntro:
      'Assign the first self-responsibility. It builds independence and never pays money.',
    assignMakeBed: 'Assign Make Bed',
    assigned: 'Assigned',
    assigning: 'Assigning…',
    historyTitle: 'Completion history',
    noHistory: 'No completions yet.',
    completed: 'Completed',
    selfInitiated: 'Self-initiated',
    guardianRecorded: 'Guardian recorded',
  },
  ar: {
    todayTitle: 'اليوم',
    responsibilities: 'المسؤوليات',
    nothingToday: 'لا توجد مسؤوليات جاهزة لليوم حتى الآن.',
    makeBedTitle: 'رتّب سريرك',
    makeBedWhy: 'الاهتمام بمساحتك الخاصة جزء من بناء الاستقلالية.',
    whyLabel: 'لماذا',
    targetPrefix: 'الوقت المستهدف',
    notAvailableYet: 'ستكون متاحة لاحقًا',
    opportunityClosed: 'انتهت فرصة تنفيذ هذه المسؤولية.',
    completionFailed: 'تعذر تسجيل الإنجاز. حاول مرة أخرى.',
    makeBedSetupTitle: 'تجربة ترتيب السرير',
    makeBedSetupIntro:
      'عيّن أول مسؤولية شخصية. الهدف هو بناء الاستقلالية، ولا ينتج عنها أي مقابل مادي.',
    assignMakeBed: 'تعيين ترتيب السرير',
    assigned: 'تم التعيين',
    assigning: 'جارٍ التعيين…',
    historyTitle: 'سجل الإنجاز',
    noHistory: 'لا توجد إنجازات مسجلة بعد.',
    completed: 'تم الإنجاز',
    selfInitiated: 'بمبادرة ذاتية',
    guardianRecorded: 'سجله ولي الأمر',
  },
} as const;

export type ActivityMessages = (typeof messages)[Locale];

export function getActivityMessages(locale: Locale): ActivityMessages {
  return messages[locale];
}
