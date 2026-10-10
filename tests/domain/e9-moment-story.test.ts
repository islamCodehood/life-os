import {describe,it,expect} from 'vitest';
import {canSeeMoment,normalizeTags,validateMoment,storyBeatForMoment,type Moment,type ValueTag} from '@/src/domain/moments/moment';
import {composeStory,storyPresentation,storyBeatKeys} from '@/src/domain/moments/story-composer';
const now=new Date('2026-10-11T00:00:00Z');
const personal:Moment={id:'mom1',familyId:'f',subjectChildId:'a',authorKind:'GUARDIAN',authorChildId:null,
 title:'We helped today',description:'Shared a good moment',privacy:'CHILD_SAFE',tags:['KINDNESS'],
 occurredAt:new Date('2026-10-10T10:00:00Z'),createdAt:now,updatedAt:now,status:'PUBLISHED',version:1};
describe('E9: privacy, values and deterministic stories',()=>{
 it('prevents sibling-private, guardian-private and archived Moments in child stories',()=>{
  expect(canSeeMoment(personal,'a')).toBe(true);
  expect(canSeeMoment(personal,'b')).toBe(false);
  expect(canSeeMoment({...personal,privacy:'GUARDIAN_PRIVATE'},'a')).toBe(false);
  expect(canSeeMoment({...personal,status:'ARCHIVED'},'a')).toBe(false);
  expect(canSeeMoment({...personal,subjectChildId:null,privacy:'FAMILY_SHARED'},'b')).toBe(true);
 });
 it('rejects shared moments with a child owner, oversize text and future timestamps',()=>{
  const fields={subjectChildId:'a',privacy:'FAMILY_SHARED' as const,title:'Hello',description:'Kind memory',
    tags:['KINDNESS'] as ValueTag[],occurredAt:now,now};
  expect(()=>validateMoment(fields)).toThrow();
  expect(()=>validateMoment({...fields,privacy:'CHILD_SAFE',title:'A'})).toThrow();
  expect(()=>validateMoment({...fields,privacy:'CHILD_SAFE',occurredAt:new Date('2030-01-01')})).toThrow();
  expect(()=>normalizeTags(['KINDNESS','KINDNESS'])).not.toThrow();
  expect(()=>normalizeTags(['KINDNESS','HONESTY','GENEROSITY','COURAGE','PATIENCE','INITIATIVE'])).toThrow();
 });
 it('chooses curated translated semantic beats, never AI-generated moral scores',()=>{
  const output=composeStory({moments:[personal],profile:'EXPLORER',visualization:'IMMERSIVE'});
  expect(output).toMatchObject([{id:'mom1',beat:'KINDNESS_MOMENT',translationKey:'kindnessMoment',
   visualCue:'heart',presentation:'ILLUSTRATED'}]);
  expect(storyBeatForMoment({...personal,privacy:'FAMILY_SHARED',tags:['FAMILY']})).toBe('FAMILY_CONTRIBUTION');
  expect(storyPresentation('BUILDER','BALANCED')).toBe('CARD');
  expect(storyPresentation('NAVIGATOR','IMMERSIVE')).toBe('TIMELINE');
  expect(storyPresentation('EXPLORER','FOCUSED')).toBe('TIMELINE');
  expect(Object.keys(storyBeatKeys)).toHaveLength(8);
  expect(JSON.stringify(output)).not.toMatch(/moralScore|xpAward|moneyCredit|leaderboard/);
 });
 it('sorts moments and milestone beats by actual timestamp, stably',()=>{
  const result=composeStory({moments:[personal],profile:'BUILDER',otherBeats:[{
   id:'goal-1',beat:'GOAL_ACHIEVED',title:'A personal goal',
   occurredAt:new Date('2026-10-10T20:00:00Z'),
  }]});
  expect(result.map(x=>x.id)).toEqual(['goal-1','mom1']);
  expect(result[0]?.translationKey).toBe('goalAchieved');
 });
});