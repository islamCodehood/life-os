declare const timeBrand: unique symbol;

export type IsoInstant = string & { readonly [timeBrand]: 'IsoInstant' };
export type IsoDate = string & { readonly [timeBrand]: 'IsoDate' };
export type IanaTimezone = string & { readonly [timeBrand]: 'IanaTimezone' };

export function toIsoInstant(value: Date): IsoInstant {
  return value.toISOString() as IsoInstant;
}
