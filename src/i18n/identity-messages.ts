import type { Locale } from './locales';

const identityMessages = {
  en: {
    heading: 'Who is using Life OS?',
    intro: 'Child profiles are scoped. Parent mode requires guardian authentication.',
    loadingProfiles: 'Loading family profiles…',
    setupNeeded: 'Family setup is not available yet.',
    setupNeededBody: 'A guardian can sign in to configure this household.',
    guardianSignIn: 'Guardian sign in',
    couldNotEnterChild: 'Could not enter child profile.',
    parentUnlockFailed: 'Parent unlock failed.',
    profile: 'Profile',
    enter: 'Enter',
    pin: 'PIN',
    enterChildProfile: 'Enter child profile',
    deviceEnrollmentRequired: 'This device must be enrolled by a parent first.',
    parent: 'Parent',
    guardianPassword: 'Guardian password',
    openParentMode: 'Open parent mode',
  },
  ar: {
    heading: 'من يستخدم Life OS؟',
    intro: 'لكل طفل نطاقه الخاص، ويتطلب وضع الوالدين تسجيل دخول ولي الأمر.',
    loadingProfiles: 'جارٍ تحميل ملفات الأسرة…',
    setupNeeded: 'إعداد الأسرة غير متاح بعد.',
    setupNeededBody: 'يمكن لولي الأمر تسجيل الدخول لإعداد هذا الجهاز والأسرة.',
    guardianSignIn: 'تسجيل دخول ولي الأمر',
    couldNotEnterChild: 'تعذر الدخول إلى ملف الطفل.',
    parentUnlockFailed: 'تعذر فتح وضع الوالدين.',
    profile: 'الملف',
    enter: 'الدخول إلى',
    pin: 'الرقم السري',
    enterChildProfile: 'الدخول إلى ملف الطفل',
    deviceEnrollmentRequired: 'يجب أن يسجل ولي الأمر هذا الجهاز أولًا.',
    parent: 'ولي الأمر',
    guardianPassword: 'كلمة مرور ولي الأمر',
    openParentMode: 'فتح وضع الوالدين',
  },
} satisfies Record<Locale, Record<string, string>>;

export type IdentityMessages = (typeof identityMessages)[Locale];

export function getIdentityMessages(locale: Locale): IdentityMessages {
  return identityMessages[locale];
}
