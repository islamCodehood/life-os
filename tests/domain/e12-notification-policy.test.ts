import {describe,it,expect} from 'vitest';
import {defaultPreference,validClock,quietAt,localClock,canSend,backoffMinutes,safeTarget} from '@/src/domain/notifications/policy';
describe('E12 notifications are optional and non-punitive',()=>{
 it('starts disabled and uses conservative quiet hours',()=>{
  expect(defaultPreference.enabled).toBe(false);
  expect(quietAt('13:00',{...defaultPreference,enabled:true})).toBe(false);
  expect(quietAt('22:30',{...defaultPreference,enabled:true})).toBe(true);
  expect(quietAt('05:30',{...defaultPreference,enabled:true})).toBe(true);
  expect(quietAt('08:30',{...defaultPreference,enabled:true})).toBe(false);
  expect(canSend(new Date('2026-10-12T18:30:00Z'),'Africa/Cairo',defaultPreference)).toBe(false);
  expect(validClock('25:00')).toBe(false);
  expect(validClock('07:00')).toBe(true);
 });
 it('respects same-day and full-day quiet hours',()=>{
  const p={enabled:true,quietStart:'12:00',quietEnd:'14:00'};
  expect(quietAt('13:00',p)).toBe(true);
  expect(quietAt('14:00',p)).toBe(false);
  expect(quietAt('00:00',{...p,quietEnd:'12:00'})).toBe(true);
  expect(quietAt('12:00',{...p,quietEnd:'12:00'})).toBe(true);
  expect(()=>quietAt('25:00',p)).toThrow();
 });
 it('uses exact family-local time around timezone boundaries',()=>{
  expect(localClock(new Date('2026-10-12T18:30:00Z'),'Africa/Cairo')).toBe('21:30');
  expect(canSend(new Date('2026-10-12T18:30:00Z'),'Africa/Cairo',
    {enabled:true,quietStart:'21:00',quietEnd:'07:00'})).toBe(false);
 });
 it('caps retries and exposes only internal allowlisted navigation',()=>{
  expect(backoffMinutes(1)).toBe(1);
  expect(backoffMinutes(2)).toBe(2);
  expect(backoffMinutes(15)).toBe(128);
  expect(safeTarget('ar','CHILD')).toBe('/ar/child');
  expect(safeTarget('en','GUARDIAN')).toBe('/en/parent');
 });
});
