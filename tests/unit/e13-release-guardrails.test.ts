import fs from 'node:fs';
import {describe,expect,it} from 'vitest';
describe('E13 security and restore contracts',()=>{
 const config=fs.readFileSync('next.config.ts','utf8');
 const exportRoute=fs.readFileSync('app/api/v1/family/export/route.ts','utf8');
 const restore=fs.readFileSync('scripts/ops/restore-disposable.mjs','utf8');
 const backup=fs.readFileSync('scripts/ops/backup-encrypted.mjs','utf8');
 it('sets MIME, framing, referrer, permission, CSP and production HTTPS headers',()=>{
  for(const header of ['X-Content-Type-Options','X-Frame-Options','Referrer-Policy',
   'Permissions-Policy','Content-Security-Policy','Strict-Transport-Security']){
   expect(config).toContain(header);
  }
  expect(config).toContain("object-src 'none'");
  expect(config).toContain("frame-ancestors 'none'");
 });
 it('limits family data exports to guardian actors and explicit resource tables',()=>{
  expect(exportRoute).toContain("actor.kind!=='GUARDIAN'");
  expect(exportRoute).toContain("eq(s.moneyTransactions.familyId,familyId)");
  expect(exportRoute).toContain("eq(s.weeklyReviewEntries.familyId,familyId)");
  expect(exportRoute).toContain("'cache-control':'private, no-store");
  expect(exportRoute).not.toMatch(/db\.select\(\)\.from\(s\.(pushSubscriptions|childPinCredentials|childSessions|householdDevices)\)/);
 });
 it('forbids non-local or source DB restores and requires encryption',()=>{
  expect(restore).toContain('CONFIRM_NON_PRODUCTION_RESTORE');
  expect(restore).toContain('127.0.0.1');
  expect(restore).toContain('DATABASE_URL_RUNTIME===target');
  expect(restore).toContain("'--decrypt'");
  expect(backup).toContain("'pg_dump'");
  expect(backup).toContain("'age'");
  expect(backup).toContain("mode:0o600");
 });
});
