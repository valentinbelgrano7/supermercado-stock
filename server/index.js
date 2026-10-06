import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { migrate } from './db/migrate.js';
import { pool } from './db/pool.js';
import { errorHandler } from './lib/http.js';
import { PUBLIC_DIR, UPLOADS_DIR } from './lib/paths.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import usersRoutes from './routes/users.js';
import categoriesRoutes from './routes/categories.js';
import suppliersRoutes from './routes/suppliers.js';
import productsRoutes from './routes/products.js';
import documentsRoutes from './routes/documents.js';
import movementsRoutes from './routes/movements.js';
import reportsRoutes from './routes/reports.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

app.use('/api/auth', authRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);
app.use('/api/users', requireAuth, usersRoutes);
app.use('/api/categories', requireAuth, categoriesRoutes);
app.use('/api/suppliers', requireAuth, suppliersRoutes);
app.use('/api/products', requireAuth, productsRoutes);
app.use('/api/documents', requireAuth, documentsRoutes);
app.use('/api/movements', requireAuth, movementsRoutes);
app.use('/api/reports', requireAuth, reportsRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// SPA en producción
if (existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
  app.use(express.static(PUBLIC_DIR, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
}

app.use(errorHandler);

async function start() {
  await migrate();
  if (process.env.SEED_DEMO === 'true') {
    const { seedDemo } = await import('./db/seed.js');
    await seedDemo({ onlyIfEmpty: true });
  }
  app.listen(PORT, () => console.log(`[api] escuchando en http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error('[api] no se pudo iniciar:', err);
  process.exit(1);
});
