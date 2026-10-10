import { describe, expect, it } from 'vitest';
import {
  currencyDecimals,
  displayMoney,
  suggestedSplit,
  toMinorUnits,
} from '@/src/ui/money/money-format';
describe('E8 currency presentation and editable Give Save Spend defaults', () => {
  it('parses currency decimal input as exact minor units, without floating arithmetic', () => {
    expect(toMinorUnits('100.25', 'EGP')).toBe('10025');
    expect(toMinorUnits('0.05', 'EGP')).toBe('5');
    expect(() => toMinorUnits('1.001', 'EGP')).toThrow();
    expect(() => toMinorUnits('1e3', 'EGP')).toThrow();
    expect(currencyDecimals('EGP')).toBe(2);
  });
  it('shows negative correction amounts with a valid sign', () => {
    expect(displayMoney('5', 'EGP')).toBe('0.05 EGP');
    expect(displayMoney('-5', 'EGP')).toBe('-0.05 EGP');
    expect(displayMoney('-1050', 'EGP')).toBe('-10.50 EGP');
  });
  it('uses Give 20 Save 60 Spend 20 and safely distributes rounding remainder', () => {
    expect(suggestedSplit('10000')).toEqual({
      giveMinor: '2000',
      saveMinor: '6000',
      spendMinor: '2000',
    });
    const split = suggestedSplit('1');
    expect(split).toEqual({ giveMinor: '0', saveMinor: '0', spendMinor: '1' });
  });
});
