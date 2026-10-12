import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'participants.json');
const adminsDbPath = path.join(dataDir, 'admins.json');
const communityDbPath = path.join(dataDir, 'community.json');
const specialChallengesDbPath = path.join(dataDir, 'special-challenges.json');
const challengeStatusPath = path.join(dataDir, 'challenge-status.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
if (!fs.existsSync(adminsDbPath)) fs.writeFileSync(adminsDbPath, JSON.stringify([], null, 2));
if (!fs.existsSync(communityDbPath)) fs.writeFileSync(communityDbPath, JSON.stringify([{ id: crypto.randomUUID(), author: 'Roche Wellness Team', role: 'admin', message: 'Welcome to the Wellness Community!', isAnnouncement: true, createdAt: new Date().toISOString() }], null, 2));

const defaultChallenges = [
  { id: crypto.randomUUID(), title: '10K Steps Sprint', description: 'Complete 10,000 steps.', points: 10, scanCode: 'ROCHE-CHALLENGE-STEPS', proofPrompt: 'Upload photo.' },
  { id: crypto.randomUUID(), title: 'Team Energy Boost', description: 'Join group activity.', points: 10, scanCode: 'ROCHE-CHALLENGE-TEAM', proofPrompt: 'Upload photo.' },
  { id: crypto.randomUUID(), title: 'Outdoor Move', description: 'Outdoor activity.', points: 10, scanCode: 'ROCHE-CHALLENGE-OUTDOOR', proofPrompt: 'Upload photo.' }
];
if (!fs.existsSync(specialChallengesDbPath)) fs.writeFileSync(specialChallengesDbPath, JSON.stringify(defaultChallenges, null, 2));

// Asegurar que la campaña inicie ACTIVA por defecto
const defaultStatus = { isActive: true, title: 'Active Challenge Campaign', startedAt: new Date().toISOString(), endedAt: '' };
if (!fs.existsSync(challengeStatusPath)) {
  fs.writeFileSync(challengeStatusPath, JSON.stringify(defaultStatus, null, 2));
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

const readJson = (f, fallback = []) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) || fallback; } catch { return fallback; } };
const writeJson = (f, val) => fs.writeFileSync(f, JSON.stringify(val, null, 2));

const readParticipants = () => readJson(dbPath, []);
const writeParticipants = (p) => writeJson(dbPath, p);
const readAdmins = () => readJson(adminsDbPath, []);
const writeAdmins = (a) => writeJson(adminsDbPath, a);
const readCommunityPosts = () => readJson(communityDbPath, []);
const readSpecialChallenges = () => readJson(specialChallengesDbPath, defaultChallenges);
const readChallengeStatus = () => readJson(challengeStatusPath, defaultStatus);

const SUPERADMIN_EMAIL = 'superadmin@roche.com';
const SUPERADMIN_PASSWORD = 'DigitalPassport*2026';

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, passwordPlain, ...rest } = user;
  return rest;
};
const normalizeEmail = (e = '') => String(e).trim().toLowerCase();

const ensureSuperAdmin = async () => {
  const admins = readAdmins();
  if (admins.some((a) => normalizeEmail(a.email) === SUPERADMIN_EMAIL)) return;
  const hash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
  admins.push({ id: crypto.randomUUID(), fullName: 'Super Admin', email: SUPERADMIN_EMAIL, password: hash, passwordPlain: SUPERADMIN_PASSWORD, role: 'superadmin', createdAt: new Date().toISOString() });
  writeAdmins(admins);
};

// --- ENDPOINTS API ---
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'wellness-passport-api' }));
app.get('/api/participants', (_req, res) => res.json({ participants: readParticipants().map(sanitizeUser) }));

app.post('/api/register', async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!fullName || !email || !password) return res.status(400).json({ message: 'Missing fields.' });
    if (!email.endsWith('@roche.com')) return res.status(400).json({ message: 'Use @roche.com email.' });

    const participants = readParticipants();
    if (participants.some((p) => normalizeEmail(p.email) === email)) return res.status(409).json({ message: 'Email registered.' });

    const hash = await bcrypt.hash(password, 10);
    const user = { id: crypto.randomUUID(), fullName, email, password: hash, passwordPlain: password, stamps: [] };
    participants.push(user);
    writeParticipants(participants);
    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const user = readParticipants().find((p) => normalizeEmail(p.email) === email);
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Invalid credentials.' });
    return res.json({ user: sanitizeUser(user) });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    await ensureSuperAdmin();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const admin = readAdmins().find((a) => normalizeEmail(a.email) === email);
    if (!admin || !(await bcrypt.compare(password, admin.password))) return res.status(401).json({ message: 'Invalid admin credentials.' });
    return res.json({ user: sanitizeUser(admin) });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// Endpoint para REGISTRAR ACTIVIDAD (Sello/Stamp desde QR)
app.post('/api/participants/:id/stamps', (req, res) => {
  try {
    const { id } = req.params;
    const { title, points, method, categoryId, date, scanCode } = req.body;

    const participants = readParticipants();
    const idx = participants.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ message: 'Participant not found.' });

    const stamp = {
      id: crypto.randomUUID(),
      title: title || 'Activity logged',
      points: Number(points || 1),
      method: method || 'qr',
      categoryId: categoryId || 'general',
      scanCode: String(scanCode || '').trim().toUpperCase(),
      date: date || new Date().toISOString()
    };

    participants[idx].stamps = [stamp, ...(participants[idx].stamps || [])];
    writeParticipants(participants);
    return res.json({ user: sanitizeUser(participants[idx]) });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

app.get('/api/admin/stats', (_req, res) => {
  const participants = readParticipants();
  const totalParticipants = participants.length;
  const totalStamps = participants.reduce((s, p) => s + (p.stamps || []).length, 0);
  const totalPoints = participants.reduce((s, p) => s + (p.stamps || []).reduce((stS, st) => stS + Number(st.points || 0), 0), 0);
  return res.json({ stats: { totalParticipants, totalStamps, totalPoints, activeParticipants: totalParticipants }, recentActivity: [] });
});

app.get('/api/challenges', (_req, res) => res.json({ challenges: readSpecialChallenges() }));
app.get('/api/admin/challenge-status', (_req, res) => res.json({ status: readChallengeStatus() }));
app.get('/api/admin/community', (_req, res) => res.json({ posts: readCommunityPosts() }));

// --- SERVIR FRONTEND ESTÁTICO DE REACT (EXPRESS 5) ---
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

const startServer = async () => {
  await ensureSuperAdmin();
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
};

startServer();
