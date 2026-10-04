import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const sourceFiles = walk(src).filter((file) => /\.(ts|tsx)$/.test(file));
const violations = [];

for (const file of sourceFiles) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const source = fs.readFileSync(file, 'utf8');

  if (rel.startsWith('src/domain/')) {
    const forbidden = ['react', 'next/', 'drizzle-orm', '@supabase/', 'dexie', '@vercel/'];

    for (const dependency of forbidden) {
      if (source.includes(`from '${dependency}`) || source.includes(`from "${dependency}`)) {
        violations.push(`${rel}: domain imports forbidden dependency ${dependency}`);
      }
    }
  }

  if (source.includes("'use client'") || source.includes('"use client"')) {
    const forbiddenClientImports = [
      '@/src/infrastructure/database',
      '@/src/infrastructure/env/server',
      'drizzle-orm',
      "from 'pg'",
      'from "pg"',
    ];

    for (const dependency of forbiddenClientImports) {
      if (source.includes(dependency)) {
        violations.push(`${rel}: client code imports server/database dependency ${dependency}`);
      }
    }
  }
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('Architecture import boundaries passed.');
