import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'dist');
const dstDir = path.join(root, 'electron', 'app');

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function rimraf(dir) {
  if (!(await exists(dir))) return;
  await fs.rm(dir, { recursive: true, force: true });
}

async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const from = path.join(src, e.name);
    const to = path.join(dst, e.name);
    if (e.isDirectory()) {
      await copyDir(from, to);
    } else if (e.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}

if (!(await exists(srcDir))) {
  console.error(`Missing ${srcDir}. Run: npm run build`);
  process.exit(1);
}

await rimraf(dstDir);
await copyDir(srcDir, dstDir);
console.log(`Synced ${srcDir} -> ${dstDir}`);

