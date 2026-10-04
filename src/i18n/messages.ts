import { isLocale as isSupportedLocale, type Locale } from './locales';

const messages = {
  en: {
    eyebrow: 'Epic 0 · Engineering Foundation',
    title: 'Life OS foundation is running.',
    description:
      'This shell proves the application, bilingual layout, providers, and frozen design system can compose before business features begin.',
    designSystemTitle: 'Design-system smoke',
    designSystemBody:
      'This card and button are imported from the pinned @life-os/design-system package.',
    smokeAction: 'Foundation ready',
    epicNote: 'No child-domain behavior is implemented in Epic 0.',
  },
  ar: {
    eyebrow: 'المرحلة صفر · الأساس الهندسي',
    title: 'الأساس التقني لنظام Life OS يعمل.',
    description:
      'تثبت هذه الصفحة أن التطبيق والاتجاه العربي ومزودي الحالة ونظام التصميم المجمد يعملون معًا قبل بدء خصائص المنتج.',
    designSystemTitle: 'اختبار نظام التصميم',
    designSystemBody:
      'هذه البطاقة وهذا الزر مستوردان من حزمة @life-os/design-system المثبتة.',
    smokeAction: 'الأساس جاهز',
    epicNote: 'لا توجد قواعد سلوكية خاصة بالأطفال ضمن المرحلة صفر.',
  },
} satisfies Record<Locale, Record<string, string>>;

export const isLocale = isSupportedLocale;

export function getMessages(locale: Locale) {
  return messages[locale];
}
