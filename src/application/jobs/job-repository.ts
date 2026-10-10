import type {Job} from '@/src/domain/jobs/job';
export interface JobRepository {
 create(job:Job):Promise<void>;
 lock(familyId:string,id:string):Promise<Job|null>;
 get(familyId:string,id:string):Promise<Job|null>;
 listChild(familyId:string,childId:string):Promise<Job[]>;
 listFamily(familyId:string):Promise<Job[]>;
 update(input:{familyId:string;id:string;expectedVersion:number;
 patch:Partial<Pick<Job,'status'|'criteria'|'paymentMinor'|'termsVersion'|'acceptedTermsVersion'>>;
 now:Date}):Promise<Job|null>;
 recordRevision(input:{id:string;familyId:string;jobId:string;termsVersion:number;criteria:string;paymentMinor:string;reason:string;now:Date}):Promise<void>;
}
