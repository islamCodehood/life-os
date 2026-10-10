export const valueTags=['KINDNESS','HONESTY','GENEROSITY','COURAGE','PATIENCE','PERSEVERANCE','FAMILY','INITIATIVE'] as const;
export type ValueTag=typeof valueTags[number];
export type MomentPrivacy='CHILD_SAFE'|'FAMILY_SHARED'|'GUARDIAN_PRIVATE';
export type MomentStatus='PUBLISHED'|'ARCHIVED';
export type StoryBeat='NEW_BEGINNING'|'PROGRESS'|'MILESTONE'|'RECOVERY'|'GRADUATION'|'FAMILY_CONTRIBUTION'|'KINDNESS_MOMENT'|'GOAL_ACHIEVED';
export type StoryPresentation='ILLUSTRATED'|'CARD'|'TIMELINE';
export interface Moment{
 id:string;familyId:string;subjectChildId:string|null;
 authorKind:'GUARDIAN'|'CHILD';authorChildId:string|null;
 title:string;description:string;privacy:MomentPrivacy;tags:ValueTag[];
 occurredAt:Date;createdAt:Date;updatedAt:Date;status:MomentStatus;version:number;
}
export type MomentSnapshot=Pick<Moment,'title'|'description'|'privacy'|'tags'|'occurredAt'|'status'|'subjectChildId'>;
export interface MomentRevision{
 id:string;familyId:string;momentId:string;version:number;
 action:'RECORDED'|'UPDATED'|'ARCHIVED';before:MomentSnapshot|null;after:MomentSnapshot;
 editedByKind:'GUARDIAN'|'CHILD';editedAt:Date;reason:string|null;
}
export class MomentRuleError extends Error {}
export function normalizeTags(tags:readonly ValueTag[]):ValueTag[]{
 const result=[...new Set(tags)];
 if(result.length>5)throw new MomentRuleError('A Moment may have at most five value tags.');
 if(result.some(tag=>!valueTags.includes(tag)))throw new MomentRuleError('Unsupported value tag.');
 return result;
}
export function validateMoment(input:{
 subjectChildId:string|null;privacy:MomentPrivacy;title:string;description:string;tags:ValueTag[];
 occurredAt:Date;now:Date;
}):void{
 if((input.privacy==='FAMILY_SHARED')!==(input.subjectChildId===null))
  throw new MomentRuleError('Shared family Moments have no individual child owner; child Moments require an owner.');
 if(input.title.trim().length<2||input.title.trim().length>140)throw new MomentRuleError('Title length is invalid.');
 if(input.description.trim().length<2||input.description.trim().length>1000)
  throw new MomentRuleError('Description length is invalid.');
 if(!Number.isFinite(input.occurredAt.getTime())||input.occurredAt.getTime()>input.now.getTime()+300000)
  throw new MomentRuleError('Moment time cannot be in the future.');
 normalizeTags(input.tags);
}
export function canSeeMoment(moment:Moment,childId:string):boolean{
 return moment.status==='PUBLISHED'&&(
  moment.privacy==='FAMILY_SHARED'||
  (moment.privacy==='CHILD_SAFE'&&moment.subjectChildId===childId)
 );
}
export function momentSnapshot(moment:Moment):MomentSnapshot{
 return {title:moment.title,description:moment.description,privacy:moment.privacy,
  tags:[...moment.tags],occurredAt:moment.occurredAt,status:moment.status,subjectChildId:moment.subjectChildId};
}
export function storyBeatForMoment(moment:Pick<Moment,'privacy'|'tags'>):StoryBeat{
 if(moment.tags.includes('KINDNESS')||moment.tags.includes('GENEROSITY'))return 'KINDNESS_MOMENT';
 return moment.privacy==='FAMILY_SHARED'||moment.tags.includes('FAMILY')?'FAMILY_CONTRIBUTION':'MILESTONE';
}
