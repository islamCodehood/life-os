import {describe,it,expect} from 'vitest';
import {canAddProgress,canRevise,canTransition,displayGoalStatus,validateGoalCreation,type Goal} from '@/src/domain/goals/goal';
const goal:Goal={id:'1',familyId:'f',ownerType:'CHILD',ownerChildId:'c',proposedByChildId:null,
 category:'PERSONAL',title:'Finish a book',why:'Learn',nextStep:'Read one chapter',target:10,progress:4,
 targetDate:'2026-10-01',status:'ACTIVE',version:1,createdAt:new Date('2026-09-01T00:00:00Z')};
describe('E7 goal rules',()=>{
 it('deadline expiry is not failure and leaves progress possible',()=>{
  expect(displayGoalStatus(goal,'2026-10-10')).toBe('TARGET_DATE_REACHED');
  expect(()=>canAddProgress(goal,2)).not.toThrow();
  expect(goal.status).toBe('ACTIVE');
 });
 it('rejects invalid ownership and sibling ranking models',()=>{
  expect(()=>validateGoalCreation({ownerType:'FAMILY',ownerChildId:'c',category:'SHARED',target:10,targetDate:null})).toThrow();
  expect(()=>validateGoalCreation({ownerType:'CHILD',ownerChildId:'c',category:'SHARED',target:10,targetDate:null})).toThrow();
 });
 it('guards progress and terminal states',()=>{
  expect(()=>canAddProgress(goal,7)).toThrow();
  expect(()=>canAddProgress(goal,-1)).toThrow();
  expect(()=>canTransition(goal,'ACHIEVED')).toThrow();
  expect(()=>canTransition({...goal,progress:10},'ACHIEVED')).not.toThrow();
  expect(()=>canTransition({...goal,status:'CLOSED'},'ACTIVE')).toThrow();
 });
 it('cannot revise below recorded progress or rewrite terminal goals',()=>{
  expect(()=>canRevise(goal,3,null)).toThrow();
  expect(()=>canRevise(goal,12,null)).not.toThrow();
  expect(()=>canRevise({...goal,status:'CLOSED'},12,null)).toThrow();
 });
});