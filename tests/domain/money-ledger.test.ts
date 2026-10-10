import {describe,expect,it} from 'vitest';
import {allocatePostings,balanced,defaultAllocation,incomePostings,nonnegativeMinor,
 outboundPostings,positiveMinor,reversePostings,walletTotals} from '@/src/domain/money/ledger';

describe('E8: integer-only double-entry money',()=>{
 it('uses exact bigint amounts for all credits and balanced postings',()=>{
  const credited=incomePostings(10000n);
  expect(credited).toMatchObject([{bucket:'UNALLOCATED',amount:10000n},{bucket:'EXTERNAL',amount:-10000n}]);
  expect(credited.reduce((sum,p)=>sum+p.amount,0n)).toBe(0n);
  expect(positiveMinor('10000')).toBe(10000n);
  expect(nonnegativeMinor('0')).toBe(0n);
  expect(()=>positiveMinor('1.5')).toThrow();
  expect(()=>positiveMinor('-1')).toThrow();
  expect(()=>balanced([{bucket:'GIVE',amount:10n},{bucket:'EXTERNAL',amount:-9n}])).toThrow();
 });
 it('requires Give + Save + Spend to exactly exhaust unallocated income',()=>{
  expect(defaultAllocation).toEqual({give:20,save:60,spend:20});
  const posted=allocatePostings({available:10000n,give:2000n,save:6000n,spend:2000n});
  expect(posted.map(p=>p.bucket)).toEqual(['UNALLOCATED','GIVE','SAVE','SPEND']);
  expect(posted.reduce((sum,p)=>sum+p.amount,0n)).toBe(0n);
  expect(()=>allocatePostings({available:10000n,give:2000n,save:6000n,spend:1999n})).toThrow();
  expect(()=>allocatePostings({available:10000n,give:-10n,save:8000n,spend:2010n})).toThrow();
 });
 it('never gives away more than the bucket holds and corrections are balanced',()=>{
  expect(()=>outboundPostings('SPEND',3000n,2000n)).toThrow();
  const original=outboundPostings('GIVE',1500n,2000n);
  expect(reversePostings(original)).toEqual(original.map(p=>({...p,amount:-p.amount})));
  const totals=walletTotals([...incomePostings(10000n),...allocatePostings({
    available:10000n,give:2000n,save:6000n,spend:2000n,
  }),...outboundPostings('SPEND',500n,2000n)],'EGP');
  expect(totals).toEqual({unallocated:'0',give:'2000',save:'6000',spend:'1500',currency:'EGP'});
 });
});
