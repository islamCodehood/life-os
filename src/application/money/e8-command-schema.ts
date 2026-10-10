import {z} from 'zod';
const uuid=z.string().uuid();
const money=z.string().regex(/^[1-9]\d{0,11}$/);
const money0=z.string().regex(/^(0|[1-9]\d{0,11})$/);
const base=z.object({commandId:uuid,schemaVersion:z.literal(1),occurredAt:z.string().datetime(),
  clientSequence:z.number().int().nonnegative().optional(),
  expectedVersions:z.array(z.object({resourceType:z.string(),resourceId:uuid,version:z.number().int().positive()})).optional()});
const jobId=z.object({jobId:uuid});
export const e8CommandSchema=z.discriminatedUnion('type',[
 base.extend({type:z.literal('CreateJob'),payload:z.object({childId:uuid,title:z.string().trim().min(2).max(140),
   criteria:z.string().trim().min(5).max(500),paymentMinor:money})}),
 base.extend({type:z.literal('ReviseJobTerms'),payload:jobId.extend({criteria:z.string().trim().min(5).max(500),paymentMinor:money,reason:z.string().trim().min(5).max(400)})}),
 ...(['AcceptJob','StartJob','SubmitJob','RequestJobRevision','RestartJob','ApproveJob','CreditApprovedJob','CancelJob'] as const)
   .map(type=>base.extend({type:z.literal(type),payload:jobId})),
 base.extend({type:z.literal('RecordGiftIncome'),payload:z.object({childId:uuid,amountMinor:money,note:z.string().trim().min(2).max(200)})}),
 base.extend({type:z.literal('RecordAllowanceIncome'),payload:z.object({childId:uuid,amountMinor:money,note:z.string().trim().min(2).max(200)})}),
 base.extend({type:z.literal('AllocateMoney'),payload:z.object({childId:uuid,giveMinor:money0,saveMinor:money0,spendMinor:money0})}),
 base.extend({type:z.literal('RecordSpend'),payload:z.object({childId:uuid,amountMinor:money,note:z.string().trim().min(2).max(200)})}),
 base.extend({type:z.literal('RecordGiving'),payload:z.object({childId:uuid,amountMinor:money,note:z.string().trim().min(2).max(200)})}),
 base.extend({type:z.literal('CorrectMoneyTransaction'),payload:z.object({transactionId:uuid,reason:z.string().trim().min(5).max(400)})}),
 base.extend({type:z.literal('CreateSavingGoal'),payload:z.object({childId:uuid,title:z.string().trim().min(2).max(140),targetMinor:money})}),
 base.extend({type:z.literal('AllocateToSavingGoal'),payload:z.object({savingGoalId:uuid,amountMinor:money})}),
 base.extend({type:z.literal('CloseSavingGoal'),payload:z.object({savingGoalId:uuid})}),
]);
