import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
const source=process.env.BACKUP_FILE;
const identity=process.env.AGE_IDENTITY_FILE;
const target=process.env.RESTORE_TARGET_DATABASE_URL;
const confirm=process.env.CONFIRM_NON_PRODUCTION_RESTORE;
const approval='YES_RESTORE_TO_DISPOSABLE_LOCAL_DATABASE';
if(!source||!identity||!target||confirm!==approval)
 throw Error('Encrypted dump, age identity, target URL and explicit disposable restore approval are required.');
const url=new URL(target);
if(!['127.0.0.1','localhost','::1'].includes(url.hostname))
 throw Error('Automated restore is permitted only on isolated localhost databases.');
if(process.env.DATABASE_URL_RUNTIME===target||process.env.DATABASE_URL_MIGRATION===target)
 throw Error('Restore target must not be the runtime or migration database.');
if(!source.endsWith('.dump.age'))throw Error('Encrypted age dump is required.');
function command(name,args,env={}){
 const child=spawn(name,args,{env:{...process.env,...env},stdio:['pipe','pipe','pipe']});
 child.stderr.on('data',()=>{}); // Never log potentially sensitive backup/credential material.
 return child;
}
function status(child){
 return new Promise((ok,fail)=>{
  child.on('error',fail);
  child.on('close',code=>code===0?ok():fail(Error('Restore command failed.')));
 });
}
const age=command('age',['--decrypt','--identity',identity]);
const restore=command('pg_restore',['--clean','--if-exists','--no-owner','--no-privileges'],{PGDATABASE:target});
const decrypted=pipeline(createReadStream(source),age.stdin);
const restored=pipeline(age.stdout,restore.stdin);
await Promise.all([decrypted,restored,status(age),status(restore)]);
process.stdout.write('Disposable localhost restore completed. Run schema and ledger verification next.\n');
