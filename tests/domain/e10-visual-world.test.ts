import {describe,expect,it} from 'vitest';
import {emptyWorld,groupRecentImpacts,projectWorld,worldStage,type WorldFact,type SemanticImpactDto} from '@/src/domain/visual-world/world';
import {islandManifest,milestoneRegions} from '@/src/domain/visual-world/island-theme';
const at=new Date('2026-10-11T19:00:00.000Z');
function entry(event:string,milestoneKey:WorldFact['milestoneKey'],scope:WorldFact['scope']='PERSONAL'):WorldFact{
 return {sourceEventId:event,familyId:'family',scope,childId:scope==='FAMILY'?null:'child',
  milestoneKey,dimension:milestoneKey==='HOME_PATH'?'INDEPENDENCE':'GOALS',occurredAt:at,recordedAt:at};
}
describe('E10 semantic projection',()=>{
 it('renders only one milestone per semantic meaning even with many source events',()=>{
  const results=projectWorld(Array.from({length:75},(_,i)=>entry('event-'+i,'HOME_PATH')),at);
  expect(results.unlocks).toHaveLength(1);
  expect(results.stage).toBe(1);
  expect(results.recentImpacts).toHaveLength(1);
 });
 it('keeps personal and family scopes separate',()=>{
  const personal=entry('p','HOME_PATH');
  const family=entry('f','FAMILY_TREE','FAMILY');
  expect(()=>projectWorld([personal,family],at)).toThrow();
  expect(projectWorld([family],at).scope).toBe('FAMILY');
  expect(emptyWorld('FAMILY')).toEqual({scope:'FAMILY',stage:1,unlocks:[],recentImpacts:[]});
 });
 it('selects oldest earned milestone and aggregates durable visual stage',()=>{
  const all=[entry('path','HOME_PATH'),entry('library','LIBRARY_OPEN'),
   entry('bridge','BRIDGE_READY'),entry('goal','OBSERVATORY_LIT'),entry('kind','GIVING_GARDEN')];
  const result=projectWorld(all,at);
  expect(result.stage).toBe(3);
  expect(result.unlocks).toHaveLength(5);
  expect(worldStage(all)).toBe(3);
  const reordered=projectWorld([entry('z','HOME_PATH'),entry('a','HOME_PATH')],at);
  expect(reordered.recentImpacts[0]?.id).toBe('a');
 });
 it('ignores historic impacts for animation while retaining earned milestones',()=>{
  const old={...entry('old','HOME_PATH'),recordedAt:new Date('2026-01-01')};
  const result=projectWorld([old],at);
  expect(result.recentImpacts).toHaveLength(0);
  expect(result.unlocks).toHaveLength(1);
 });
 it('groups offline bulk effects per region and respects motion preferences',()=>{
  const impacts:SemanticImpactDto[]=Array.from({length:70},(_,i)=>({
   id:String(i),semanticKey:i%2?'HOME_PATH':'LIBRARY_OPEN',
   dimension:'LEARNING',occurredAt:at.toISOString(),
  }));
  expect(groupRecentImpacts(impacts,'FULL')).toEqual([
   {semanticKey:'LIBRARY_OPEN',count:35},{semanticKey:'HOME_PATH',count:35},
  ]);
  expect(groupRecentImpacts(impacts,'REDUCED')).toHaveLength(1);
  expect(groupRecentImpacts(impacts,'OFF')).toHaveLength(0);
 });
 it('theme and rendering preferences do not alter semantic meaning',()=>{
  expect(islandManifest('space').regions).toEqual(islandManifest('island').regions);
  expect(milestoneRegions.HOME_PATH).toBe('PATH');
  const first=projectWorld([entry('a','HOME_PATH')],at);
  expect(first.unlocks).toEqual(projectWorld([entry('a','HOME_PATH')],at).unlocks);
  expect(JSON.stringify(first)).not.toMatch(/points|money|moralScore|leaderboard|xpAward/);
 });
});