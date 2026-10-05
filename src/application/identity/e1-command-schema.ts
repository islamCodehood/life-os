import { z } from 'zod';

const base = z.object({
  commandId: z.string().uuid(),
  schemaVersion: z.literal(1),
  occurredAt: z.string().datetime(),
});

const childId = z.string().uuid();
const deviceId = z.string().uuid();

export const e1CommandSchema = z.discriminatedUnion('type', [
  base.extend({
    type: z.literal('CreateChildProfile'),
    payload: z.object({
      displayName: z.string().min(1).max(100),
      birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      avatarKey: z.string().max(100).nullable().optional(),
    }),
  }),
  base.extend({
    type: z.literal('UpdateExperiencePreferences'),
    payload: z.object({
      childId,
      visualization: z.enum(['IMMERSIVE', 'BALANCED', 'FOCUSED']),
      motion: z.enum(['FULL', 'REDUCED', 'OFF']),
      themeKey: z.string().min(1).max(100),
    }),
  }),
  base.extend({
    type: z.literal('RegisterHouseholdDevice'),
    payload: z.object({ label: z.string().min(1).max(100) }),
  }),
  base.extend({
    type: z.literal('RevokeHouseholdDevice'),
    payload: z.object({ deviceId }),
  }),
  base.extend({
    type: z.literal('SetChildPin'),
    payload: z.object({ childId, pin: z.string().min(1).max(32) }),
  }),
  base.extend({
    type: z.literal('ResetChildPin'),
    payload: z.object({ childId, pin: z.string().min(1).max(32) }),
  }),
]);

export type E1Command = z.infer<typeof e1CommandSchema>;

export const createFamilyCommandSchema = base.extend({
  type: z.literal('CreateFamily'),
  payload: z.object({
    name: z.string().min(1).max(120),
    timezone: z.string().min(1).max(120),
    currency: z.string().length(3),
  }),
});
