import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const url=process.env.DATABASE_URL_MIGRATION;
const recipient=process.env.AGE_RECIPIENT;
const filename=process.env.BACKUP_FILE;
if(!url||!recipient||!filename)
 throw Error('DATABASE_URL_MIGRATION, AGE_RECIPIENT and BACKUP_FILE are required.');
if(!/^age1[0-9a-z]{50,}$/.test(recipient))throw Error('Expected an age public recipient key.');
if(!filename.endsWith('.dump.age'))throw Error('Encrypted backup filename must end in .dump.age');
const file=resolve(filename);
function command(name,args,env={}){
 const child=spawn(name,args,{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
 child.stderr.on('data',()=>{}); // Do not leak DB URL, operational private data or encryption diagnostics.
 return child;
}
function status(child){
 return new Promise((ok,fail)=>{
  child.on('error',fail);
  child.on('close',code=>code===0?ok():fail(Error('Encrypted backup pipeline failed.')));
 });
}
const dump=command('pg_dump',['--format=custom','--no-owner','--no-privileges'],{PGDATABASE:url});
const encrypted=command('age',['-r',recipient]);
dump.stdout.pipe(encrypted.stdin);
try{
await Promise.all([
 pipeline(encrypted.stdout,createWriteStream(file,{flags:'wx',mode:0o600})),
 status(dump),status(encrypted),
]);
process.stdout.write('Encrypted PostgreSQL backup created: '+file+'\n');
