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
  { id: crypto.randomUUID(), title: '10K Steps Sprint', description: 'Complete 10,000 steps across the week.', points: 10, scanCode: 'ROCHE-CHALLENGE-STEPS', proofPrompt: 'Upload photo.' },
  { id: crypto.randomUUID(), title: 'Team Energy Boost', description: 'Join group activity.', points: 10, scanCode: 'ROCHE-CHALLENGE-TEAM', proofPrompt: 'Upload photo.' },
  { id: crypto.randomUUID(), title: 'Outdoor Move', description: 'Outdoor activity.', points: 10, scanCode: 'ROCHE-CHALLENGE-OUTDOOR', proofPrompt: 'Upload photo.' }
];
if (!fs.existsSync(specialChallengesDbPath)) fs.writeFileSync(specialChallengesDbPath, JSON.stringify(defaultChallenges, null, 2));

const defaultStatus = { isActive: true, title: 'Active Campaign', startedAt: new Date().toISOString(), endedAt: '' };
if (!fs.existsSync(challengeStatusPath)) fs.writeFileSync(challengeStatusPath, JSON.stringify(defaultStatus, null, 2));

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
const writeCommunityPosts = (p) => writeJson(communityDbPath, p);
const readSpecialChallenges = () => readJson(specialChallengesDbPath, defaultChallenges);
const writeSpecialChallenges = (c) => writeJson(specialChallengesDbPath, c);
const readChallengeStatus = () => readJson(challengeStatusPath, defaultStatus);
const writeChallengeStatus = (s) => writeJson(challengeStatusPath, s);

const SUPERADMIN_EMAIL = 'superadmin@roche.com';
const SUPERADMIN_PASSWORD = 'DigitalPassport*2026';

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, passwordPlain, ...rest } = user;
  return rest;
};
const normalizeEmail = (e = '') => String(e).trim().toLowerCase();

const categoryQrConfigurations = [
  { id: 'gym', categoryId: 'gym', title: 'Gym / Solo Workout', points: 1, code: 'ROCHE-GYM-101', scanCode: 'ROCHE-GYM-101', isCategory: true },
  { id: 'group', categoryId: 'group', title: 'Group Fitness Class', points: 2, code: 'ROCHE-GROUP-202', scanCode: 'ROCHE-GROUP-202', isCategory: true },
  { id: 'sports', categoryId: 'sports', title: 'Sports & Outdoor Game', points: 2, code: 'ROCHE-SPORTS-303', scanCode: 'ROCHE-SPORTS-303', isCategory: true }
];

const buildQrCatalog = async () => {
  try {
    const specialChallenges = readSpecialChallenges();
    const challengeItems = await Promise.all(
      specialChallenges.map(async (ch) => ({
        id: ch.id,
        title: ch.title,
        points: Number(ch.points || 10),
        code: ch.scanCode,
        scanCode: ch.scanCode,
        isCategory: false,
        qrCode: await QRCode.toDataURL(ch.scanCode, { margin: 1, width: 420, color: { dark: '#0f172a', light: '#ffffff' } })
      }))
    );
    const items = await Promise.all(
      categoryQrConfigurations.map(async (cat) => ({
        ...cat,
        qrCode: await QRCode.toDataURL(cat.code, { margin: 1, width: 420, color: { dark: '#0f172a', light: '#ffffff' } })
      }))
    );
    return [...items, ...challengeItems];
  } catch (err) {
    console.error("Error generating QR catalog:", err);
    return [];
  }
};

const ensureSuperAdmin = async () => {
  const admins = readAdmins();
  if (admins.some((a) => normalizeEmail(a.email) === SUPERADMIN_EMAIL)) return;
  const hash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
  admins.push({ id: crypto.randomUUID(), fullName: 'Super Admin', email: SUPERADMIN_EMAIL, password: hash, passwordPlain: SUPERADMIN_PASSWORD, role: 'superadmin', createdAt: new Date().toISOString() });
  writeAdmins(admins);
};

// --- ENDPOINTS DE LA API ---
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

// Catálogo de QR codes estructurado para el Admin Portal
app.get('/api/admin/qr-codes', async (_req, res) => {
  try {
    const qrCodes = await buildQrCatalog();
    return res.json({ qrCodes, categories: categoryQrConfigurations });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to generate QR codes', error: err.message });
  }
});

// Estadísticas del Admin Dashboard
app.get('/api/admin/stats', (_req, res) => {
  try {
    const participants = readParticipants();
    const totalParticipants = participants.length;
    const totalStamps = participants.reduce((s, p) => s + (p.stamps || []).length, 0);
    const totalPoints = participants.reduce((s, p) => s + (p.stamps || []).reduce((stS, st) => stS + Number(st.points || 0), 0), 0);
    const categoryBreakdown = participants.reduce((b, p) => {
      (p.stamps || []).forEach((st) => { const k = st.categoryId || 'unknown'; b[k] = (b[k] || 0) + 1; });
      return b;
    }, {});
    const recentActivity = participants
      .flatMap((p) => (p.stamps || []).map((st) => ({ ...st, participantName: p.fullName, participantEmail: p.email })))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);
    const activeParticipants = participants.filter((p) => (p.stamps || []).length > 0).length;

    return res.json({
      stats: { totalParticipants, totalStamps, totalPoints, activeParticipants, averagePoints: totalParticipants ? Number((totalPoints / totalParticipants).toFixed(1)) : 0, categoryBreakdown },
      recentActivity
    });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// Registrar actividad (Sello / Stamp desde QR)
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

// Administración de Retos
app.get('/api/challenges', (_req, res) => res.json({ challenges: readSpecialChallenges() }));
app.get('/api/admin/challenge-status', (_req, res) => res.json({ status: readChallengeStatus() }));

app.post('/api/admin/challenges', (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    if (!title || !description) return res.status(400).json({ message: 'Title and description required.' });

    const challenges = readSpecialChallenges();
    const challenge = { id: crypto.randomUUID(), title, description, points: Number(req.body.points || 10), scanCode: String(req.body.scanCode || `ROCHE-SPECIAL-${crypto.randomUUID().slice(0, 8)}`).toUpperCase(), proofPrompt: String(req.body.proofPrompt || 'Upload a photo.').trim() };
    challenges.unshift(challenge);
    writeSpecialChallenges(challenges);
    return res.status(201).json({ challenge });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

app.delete('/api/admin/challenges/:id', (req, res) => {
  try {
    const challenges = readSpecialChallenges().filter((c) => c.id !== req.params.id);
    writeSpecialChallenges(challenges);
    return res.json({ deleted: true, count: challenges.length });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// Administración de Comunidad
app.get('/api/admin/community', (_req, res) => res.json({ posts: readCommunityPosts() }));

app.post('/api/admin/community', (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    const posts = readCommunityPosts();
    const post = { id: crypto.randomUUID(), author: 'Roche Wellness Team', role: 'admin', message, image: req.body.image || '', isAnnouncement: Boolean(req.body.isAnnouncement), createdAt: new Date().toISOString() };
    posts.unshift(post);
    writeCommunityPosts(posts);
    return res.status(201).json({ post });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

app.delete('/api/admin/community/:id', (req, res) => {
  try {
    const posts = readCommunityPosts().filter((p) => p.id !== req.params.id);
    writeCommunityPosts(posts);
    return res.json({ deleted: true, count: posts.length });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

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
