'use client';
import {useState} from 'react';
import {Button,Card} from '@life-os/design-system';
import type {NotificationPreference} from '@/src/domain/notifications/policy';
import type {NotificationMessages} from '@/src/i18n/notification-messages';
type Props={initial:{preference:NotificationPreference;subscriptions:number;configured:boolean};
 messages:NotificationMessages};
function decodeVapidKey(base64:string):Uint8Array<ArrayBuffer>{
 const pad='='.repeat((4-base64.length%4)%4);
 const value=atob((base64+pad).replace(/-/g,'+').replace(/_/g,'/'));
 const array=new Uint8Array(new ArrayBuffer(value.length));
 for(let i=0;i<value.length;i++)array[i]=value.charCodeAt(i);
 return array;
}
export function NotificationPanel({initial,messages}:Props){
 const [value,setValue]=useState(initial.preference),[devices,setDevices]=useState(initial.subscriptions);
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 async function request(method:string,path:string,body:unknown){
  const result=await fetch(path,{method,headers:{'content-type':'application/json'},
   body:JSON.stringify(body),cache:'no-store'});
  if(!result.ok)throw Error('Notification update rejected');
  return result.json();
 }
 async function save(enabled:boolean){
  if(busy)return;
  setBusy(true);setError(null);
  try{
   if(enabled){
    const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if(!initial.configured||!publicKey)throw Error('not configured');
    if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))
      throw Error('unsupported');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw Error('permission denied');
    const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
    const existing=await registration.pushManager.getSubscription();
    const subscription=existing??await registration.pushManager.subscribe({
     userVisibleOnly:true,applicationServerKey:decodeVapidKey(publicKey),
    });
    const snapshot=subscription.toJSON();
    await request('POST','/api/v1/notifications/subscription',{
     endpoint:subscription.endpoint,keys:snapshot.keys,
    });
   }else if('serviceWorker' in navigator){
    const registration=await navigator.serviceWorker.getRegistration('/');
    const subscription=await registration?.pushManager.getSubscription();
    if(subscription){
     await request('DELETE','/api/v1/notifications/subscription',{endpoint:subscription.endpoint});
     await subscription.unsubscribe();
    }
   }
   const result=await request('PUT','/api/v1/notifications',{...value,enabled});
   setValue(result.preference);setDevices(result.subscriptions);
  }catch(e){
   const message=(e as Error).message;
   setError(message==='unsupported'?messages.unsupported:
    message==='permission denied'?messages.permissionDenied:
    message==='not configured'?messages.notConfigured:messages.error);
  }finally{setBusy(false)}
 }
 return <Card variant="soft" className="lo-app-foundation__card">
  <section aria-label={messages.title}>
   <h2>{messages.title}</h2><p>{messages.description}</p>
   <p>{value.enabled?messages.statusOn:messages.statusOff} · {messages.deviceCount}: {devices}</p>
   <form onSubmit={event=>{event.preventDefault();void save(value.enabled)}}>
    <label>{messages.quietStart}<input type="time" value={value.quietStart}
     onChange={event=>setValue(p=>({...p,quietStart:event.target.value}))}/></label>
    <label>{messages.quietEnd}<input type="time" value={value.quietEnd}
     onChange={event=>setValue(p=>({...p,quietEnd:event.target.value}))}/></label>
    <Button type="submit" disabled={busy}>{messages.save}</Button>
   </form>
   <Button type="button" disabled={busy} onClick={()=>void save(!value.enabled)}>
    {value.enabled?messages.disable:messages.enable}
   </Button>
   {error&&<p role="alert">{error}</p>}<p>{messages.note}</p>
  </section>
 </Card>;
}
