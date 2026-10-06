import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(__dirname, '..', '..');
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(ROOT_DIR, 'uploads');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'server', 'public');

mkdirSync(UPLOADS_DIR, { recursive: true });
