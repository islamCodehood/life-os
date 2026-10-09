import { v7 as uuidv7 } from 'uuid';

declare const brand: unique symbol;

export type BrandedId<Name extends string> = string & {
  readonly [brand]: Name;
};

export type FamilyId = BrandedId<'FamilyId'>;
export type GuardianId = BrandedId<'GuardianId'>;
export type ChildId = BrandedId<'ChildId'>;
export type DeviceId = BrandedId<'DeviceId'>;
export type ChildSessionId = BrandedId<'ChildSessionId'>;
export type CommandId = BrandedId<'CommandId'>;
export type ActivityDefinitionId = BrandedId<'ActivityDefinitionId'>;
export type ActivityAssignmentId = BrandedId<'ActivityAssignmentId'>;
export type ActivityInstanceId = BrandedId<'ActivityInstanceId'>;
export type CompletionRecordId = BrandedId<'CompletionRecordId'>;
export type ReminderRecordId = BrandedId<'ReminderRecordId'>;
export type DomainEventId = BrandedId<'DomainEventId'>;

export function newId<Name extends string>(): BrandedId<Name> {
  return uuidv7() as BrandedId<Name>;
}
