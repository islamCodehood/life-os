import type {Locale} from './locales';
const messages={
 en:{
 title:'Gentle notifications',description:'Optional reminders to help your family. Delivery is not a measure of behaviour.',
 enable:'Enable push on this device',disable:'Turn off notifications',
 quietStart:'Quiet hours start',quietEnd:'Quiet hours end',
 save:'Save preferences',statusOn:'Notifications enabled',statusOff:'Notifications are off',
 deviceCount:'Registered devices',unsupported:'Push is not supported in this browser or installation.',
 permissionDenied:'Browser notification permission was declined.',
 notConfigured:'Web Push is not configured on this deployment.',
 error:'Could not save notification settings. Check connectivity and try again.',
 note:'Quiet hours use the family’s timezone. A missed push never counts as an ignored reminder.',
 },
 ar:{
 title:'تنبيهات لطيفة',description:'تذكيرات اختيارية لمساعدة الأسرة، وليست مقياساً للسلوك.',
 enable:'تفعيل الإشعارات على هذا الجهاز',disable:'إيقاف الإشعارات',
 quietStart:'بداية وقت الهدوء',quietEnd:'نهاية وقت الهدوء',
 save:'حفظ التفضيلات',statusOn:'الإشعارات مفعلة',statusOff:'الإشعارات متوقفة',
 deviceCount:'الأجهزة المسجلة',unsupported:'لا يدعم هذا المتصفح أو هذا التثبيت الإشعارات.',
 permissionDenied:'لم يتم السماح بإشعارات المتصفح.',
 notConfigured:'لم يتم تهيئة خدمة الإشعارات في هذا النشر.',
 error:'تعذر حفظ إعدادات التنبيهات. تحقق من الاتصال وحاول مجدداً.',
 note:'تستخدم أوقات الهدوء المنطقة الزمنية للأسرة، ولا تعتبر الإشعارات الفاشلة تجاهلاً من الطفل.',
 }
} as const;
export type NotificationMessages=(typeof messages)[Locale];
export function getNotificationMessages(locale:Locale):NotificationMessages{return messages[locale];}
