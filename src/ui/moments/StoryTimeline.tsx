import {Card} from '@life-os/design-system';
import type {StoryItem} from '@/src/domain/moments/story-composer';
import type {StoryMessages} from '@/src/i18n/story-messages';
const cues:Record<string,string>={
 sunrise:'🌅',path:'🛤️',star:'⭐',sprout:'🌱',bridge:'🌉',
 'family-tree':'🌳',heart:'💛',peak:'🏔️',
};
export function StoryTimeline({items,messages,locale}:{
 items:StoryItem[];messages:StoryMessages;locale:'en'|'ar';
}){
 const personal=items.filter(i=>!i.isFamily),family=items.filter(i=>i.isFamily);
 const date=new Intl.DateTimeFormat(locale==='ar'?'ar-EG':'en',{dateStyle:'medium'});
 function renderStory(item:StoryItem){
  return <Card key={item.id} variant="soft" className="lo-app-foundation__card">
   <article data-story-presentation={item.presentation} data-story-beat={item.beat}>
    <p aria-hidden="true" style={{fontSize:item.presentation==='ILLUSTRATED'?'3rem':'1.6rem'}}>
     {cues[item.visualCue]??'✨'}
    </p>
    <p>{messages[item.translationKey]}</p>
    <h4>{item.title}</h4>
    {item.description&&<p>{item.description}</p>}
    <time dateTime={item.occurredAt}>{date.format(new Date(item.occurredAt))}</time>
    {item.tags.length>0&&<p>{item.tags.map(tag=>messages.values[tag as keyof typeof messages.values]).join(' · ')}</p>}
   </article>
  </Card>;
 }
 return <section aria-label={messages.heading}>
  <h2>{messages.heading}</h2><p>{messages.subtitle}</p>
  <h3>{messages.personal}</h3>
  {personal.length?personal.map(renderStory):<p>{messages.none}</p>}
  <h3>{messages.family}</h3>
  {family.length?family.map(renderStory):<p>{messages.none}</p>}
 </section>;
}
