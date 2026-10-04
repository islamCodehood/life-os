import { pgSchema } from 'drizzle-orm/pg-core';

export const lifeOsSchema = pgSchema('life_os');

// E0 intentionally defines no business-domain tables.
// E1 owns the first family/guardian/child persistence model.
