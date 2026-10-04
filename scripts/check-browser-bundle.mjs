import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), '.next', 'static', 'chunks');

if (!fs.existsSync(root)) {
  console.error('Browser bundle not found. Run pnpm build first.');
  process.exit(1);
}

const forbidden = [
  'DATABASE_URL_RUNTIME',
  'DATABASE_URL_MIGRATION',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CHILD_SESSION_HASH_SECRET',
  'INTERNAL_SCHEDULER_SECRET',
  'VAPID_PRIVATE_KEY',
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const matches = [];
for (const file of walk(root).filter((file) => file.endsWith('.js'))) {
  const source = fs.readFileSync(file, 'utf8');
  for (const token of forbidden) {
    if (source.includes(token)) {
      matches.push(`${path.relative(process.cwd(), file)}: ${token}`);
    }
  }
}

if (matches.length) {
  console.error('Server-only configuration leaked into browser chunks:\n' + matches.join('\n'));
  process.exit(1);
}

console.log('Browser bundle contains no server-only configuration markers.');
