import { describe, expect, it } from 'vitest';
import { awardForCompletion, skillProgressFromLedger, validateCorrection, type XpEntry } from '@/src/domain/growth/skill-xp';

const growth = { category: 'GROWTH' as const, xpMode: 'ALLOWED', xpAmount: 10 };
const grant: XpEntry = {
  id:'g1', familyId:'f1', childId:'c1', skillKey:'CHESS',
  entryType:'GRANT', amount:10, sourceEventId:'e1', correctionOf:null,
  correctionReason:null, occurredAt:new Date(), recordedAt:new Date(),
};
describe('E6 skill XP rules', () => {
  it('awards only eligible server-configured growth', () => {
    expect(awardForCompletion({ ...growth, templateKey:'GROWTH_CHESS_PRACTICE' })).toEqual({skillKey:'CHESS',amount:10});
    expect(awardForCompletion({ ...growth, templateKey:'GROWTH_READING' })).toEqual({skillKey:'READING',amount:10});
    expect(awardForCompletion({ ...growth, templateKey:'SELF_MAKE_BED', category:'SELF_RESPONSIBILITY' })).toBeNull();
    expect(awardForCompletion({ ...growth, templateKey:'GROWTH_READING', category:'VALUES' })).toBeNull();
    expect(awardForCompletion({ ...growth, templateKey:'GROWTH_READING', category:'FAITH' })).toBeNull();
    expect(awardForCompletion({ ...growth, templateKey:'GROWTH_READING', xpMode:'FORBIDDEN' })).toBeNull();
    expect(awardForCompletion({ ...growth, templateKey:'GROWTH_READING', xpAmount:999 })).toBeNull();
  });
  it('keeps separate per-skill milestones and never global worth', () => {
    const entries: XpEntry[] = Array.from({length:5}, (_,i) => ({
      ...grant, id:'g'+i, sourceEventId:'e'+i,
    }));
    const [reading,chess] = skillProgressFromLedger(entries);
    expect(reading).toMatchObject({xp:0,nextMilestone:50});
    expect(chess).toMatchObject({xp:50,achievedMilestones:[50],nextMilestone:100});
  });
  it('corrections reverse mistakes, never apply punishment', () => {
    expect(validateCorrection(grant,false)).toBe(-10);
    expect(()=>validateCorrection(grant,true)).toThrow();
    expect(()=>validateCorrection({...grant,entryType:'CORRECTION'},false)).toThrow();
    const xp = skillProgressFromLedger([grant,{...grant,id:'c1',sourceEventId:'e2',entryType:'CORRECTION',amount:-10,correctionOf:'g1',correctionReason:'Error'}]);
    expect(xp.find(v=>v.skillKey==='CHESS')?.xp).toBe(0);
  });
});
