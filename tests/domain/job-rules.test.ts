import { describe, it, expect } from 'vitest';
import { jobTransition, validateJobPayment, type Job } from '@/src/domain/jobs/job';
const job: Job = {
  id: 'job',
  familyId: 'f',
  childId: 'c',
  title: 'Paid extra work',
  criteria: 'Prepare the books',
  paymentMinor: '10000',
  currency: 'EGP',
  status: 'OFFERED',
  termsVersion: 1,
  acceptedTermsVersion: null,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};
describe('E8 job terms and transitions', () => {
  it('unapproved jobs can never be credited', () => {
    expect(() => jobTransition(job, 'CREDIT')).toThrow();
    expect(() =>
      jobTransition({ ...job, status: 'SUBMITTED', acceptedTermsVersion: 1 }, 'CREDIT'),
    ).toThrow();
  });
  it('requires child to accept the latest version', () => {
    expect(jobTransition(job, 'ACCEPT')).toBe('ACCEPTED');
    expect(() =>
      jobTransition({ ...job, status: 'ACCEPTED', acceptedTermsVersion: null }, 'START'),
    ).toThrow();
    expect(() =>
      jobTransition(
        { ...job, status: 'ACCEPTED', termsVersion: 2, acceptedTermsVersion: 1 },
        'SUBMIT',
      ),
    ).toThrow();
    expect(jobTransition({ ...job, status: 'ACCEPTED', acceptedTermsVersion: 1 }, 'START')).toBe(
      'IN_PROGRESS',
    );
    expect(
      jobTransition({ ...job, status: 'IN_PROGRESS', acceptedTermsVersion: 1 }, 'SUBMIT'),
    ).toBe('SUBMITTED');
    expect(jobTransition({ ...job, status: 'SUBMITTED', acceptedTermsVersion: 1 }, 'APPROVE')).toBe(
      'AWAITING_CREDIT',
    );
    expect(
      jobTransition({ ...job, status: 'AWAITING_CREDIT', acceptedTermsVersion: 1 }, 'CREDIT'),
    ).toBe('CREDITED');
  });
  it('does not permit zero, negative, or floating payment', () => {
    expect(validateJobPayment('10000')).toBe(10000n);
    expect(() => validateJobPayment('0')).toThrow();
    expect(() => validateJobPayment('-100')).toThrow();
    expect(() => validateJobPayment('10.50')).toThrow();
  });
});
