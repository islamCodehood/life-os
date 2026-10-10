export type JobStatus = 'OFFERED' | 'ACCEPTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'NEEDS_REVISION' | 'APPROVED' | 'AWAITING_CREDIT' | 'CREDITED' | 'CANCELLED' | 'CANCELLED_WITH_WORK';
export interface Job {
  id:string; familyId:string; childId:string; title:string; criteria:string;
  paymentMinor:string; currency:string; status:JobStatus;
  termsVersion:number; acceptedTermsVersion:number|null; version:number;
  createdAt:Date; updatedAt:Date;
}
export class JobRuleError extends Error {}
export function jobTransition(job:Job,action:'ACCEPT'|'START'|'SUBMIT'|'REQUEST_REVISION'|'RESTART'|'APPROVE'|'CREDIT'|'CANCEL'):JobStatus {
  const allowed:Record<typeof action,JobStatus[]> = {
    ACCEPT:['OFFERED','NEEDS_REVISION'],START:['ACCEPTED'],
    SUBMIT:['ACCEPTED','IN_PROGRESS'],REQUEST_REVISION:['SUBMITTED'],
    RESTART:['NEEDS_REVISION'],APPROVE:['SUBMITTED'],CREDIT:['AWAITING_CREDIT'],
    CANCEL:['OFFERED','ACCEPTED','IN_PROGRESS','SUBMITTED','NEEDS_REVISION'],
  };
  if(!allowed[action].includes(job.status))throw new JobRuleError('Job cannot move to this state.');
  if(action!=='ACCEPT' && action!=='CANCEL' && job.acceptedTermsVersion!==job.termsVersion)
    throw new JobRuleError('Revised terms must be accepted before more work.');
  const to:Record<typeof action,JobStatus>={
    ACCEPT:'ACCEPTED',START:'IN_PROGRESS',SUBMIT:'SUBMITTED',
    REQUEST_REVISION:'NEEDS_REVISION',RESTART:'IN_PROGRESS',
    APPROVE:'AWAITING_CREDIT',CREDIT:'CREDITED',CANCEL:'CANCELLED',
  };
  return to[action];
}
export function validateJobPayment(value:string) {
  if(!/^[1-9]\d{0,11}$/.test(value))throw new JobRuleError('Payment must be a positive integer in minor currency units.');
  return BigInt(value);
}
export function requireAcceptedTerms(job:Job) {
  if(job.acceptedTermsVersion!==job.termsVersion)throw new JobRuleError('Child must explicitly accept the latest terms.');
}
