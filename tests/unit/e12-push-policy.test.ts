import {describe,expect,it} from 'vitest';
import {assertPushEndpoint} from '@/src/infrastructure/notifications/web-push';
describe('E12 Web Push endpoint safety',()=>{
 it('accepts only established HTTPS push service hosts',()=>{
  expect(assertPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'))
   .toBe('https://fcm.googleapis.com/fcm/send/abc');
  expect(assertPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/a'))
   .toContain('mozilla.com');
  expect(assertPushEndpoint('https://web.push.apple.com/abc')).toContain('apple.com');
 });
 it('refuses arbitrary attacker-controlled URLs and private networks',()=>{
  for(const endpoint of [
   'http://127.0.0.1/private','https://127.0.0.1/internal','https://localhost/private',
   'https://169.254.169.254/latest','https://fcm.googleapis.com.evil.example/test',
   'https://malicious.test/path','https://fcm.googleapis.com:1234/test',
   'https://username:password@fcm.googleapis.com/something',
  ])expect(()=>assertPushEndpoint(endpoint)).toThrow();
 });
});
