import {expect,test} from '@playwright/test';
test('@smoke public shell has baseline security headers',async({request})=>{
 const response=await request.get('/en');
 expect(response.ok()).toBeTruthy();
 const headers=response.headers();
 expect(headers['x-content-type-options']).toBe('nosniff');
 expect(headers['x-frame-options']).toBe('DENY');
 expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
 expect(headers['content-security-policy']).toContain("object-src 'none'");
 expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
});
test('@smoke installed service worker serves an offline LTR shell',async({page,context})=>{
 await page.goto('/en');
 await page.evaluate(async()=>{
  const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
  await navigator.serviceWorker.ready;
  if(!registration.active)await new Promise(resolve=>setTimeout(resolve,250));
 });
 await page.reload();
 await context.setOffline(true);
 try{
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('html')).toHaveAttribute('dir','ltr');
 }finally{await context.setOffline(false);}
});
