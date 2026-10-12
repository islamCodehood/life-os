export type NotificationKind = 'ACTIVITY_REMINDER' | 'GRADUATED_MONITORING' | 'SUGGESTION_REVIEW';
export interface NotificationPreference { enabled:boolean; quietStart:string; quietEnd:string; }
export const defaultPreference:NotificationPreference={enabled:false,quietStart:'21:00',quietEnd:'07:00'};
export function validClock(value:string):boolean {return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)}
export function quietAt(localClock:string,p:NotificationPreference):boolean {
 if(!p.enabled) return true;
 if(!validClock(localClock)||!validClock(p.quietStart)||!validClock(p.quietEnd))throw Error('Invalid clock');
 if(p.quietStart===p.quietEnd)return true;
 return p.quietStart<p.quietEnd
   ?localClock>=p.quietStart&&localClock<p.quietEnd
   :localClock>=p.quietStart||localClock<p.quietEnd;
}
export function localClock(now:Date,timezone:string):string {
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 return parts.find(p=>p.type==='hour')!.value+':'+parts.find(p=>p.type==='minute')!.value;
}
export function canSend(now:Date,timezone:string,p:NotificationPreference):boolean{
 return p.enabled&&!quietAt(localClock(now,timezone),p);
}
export function backoffMinutes(attempt:number):number{
 return Math.min(240,2**Math.min(Math.max(attempt-1,0),7));
}
export function safeTarget(locale:'ar'|'en',role:'GUARDIAN'|'CHILD'):string{
 return '/'+locale+(role==='GUARDIAN'?'/parent':'/child');
}
