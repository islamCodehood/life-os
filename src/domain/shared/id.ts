declare const brand: unique symbol;

export type BrandedId<Name extends string> = string & {
  readonly [brand]: Name;
};

export type FamilyId = BrandedId<'FamilyId'>;
export type GuardianId = BrandedId<'GuardianId'>;
export type ChildId = BrandedId<'ChildId'>;
export type CommandId = BrandedId<'CommandId'>;
