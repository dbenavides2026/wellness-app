import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiRoutes from './routes.js';
import { ensureSuperAdmin } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// 1. Cargar las rutas de la API
app.use('/api', apiRoutes);

// 2. Servir el Frontend estático de React (Express 5)
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

const startServer = async () => {
  await ensureSuperAdmin();
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
};

startServer();
