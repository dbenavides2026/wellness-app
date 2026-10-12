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

if (!fs.existsSync(communityDbPath)) {
  fs.writeFileSync(communityDbPath, JSON.stringify([{
    id: crypto.randomUUID(),
    author: 'Roche Wellness Team',
    role: 'admin',
    message: 'Welcome to the Wellness Community — share wins, workouts, and encouragement with the team.',
    image: '',
    isAnnouncement: true,
    createdAt: new Date().toISOString()
  }], null, 2));
}

const defaultSpecialChallenges = [
  { id: crypto.randomUUID(), title: '10K Steps Sprint', description: 'Complete 10,000 steps across the week and log your movement with proof.', points: 10, scanCode: 'ROCHE-CHALLENGE-STEPS', proofPrompt: 'Upload a photo showing your steps challenge progress or movement moment.' },
  { id: crypto.randomUUID(), title: 'Team Energy Boost', description: 'Join a team wellness activity and share a photo check-in from the session.', points: 10, scanCode: 'ROCHE-CHALLENGE-TEAM', proofPrompt: 'Upload a photo of your team workout, class, or group challenge moment.' },
  { id: crypto.randomUUID(), title: 'Outdoor Move', description: 'Take part in an outdoor or sport challenge and submit proof of your activity.', points: 10, scanCode: 'ROCHE-CHALLENGE-OUTDOOR', proofPrompt: 'Upload a photo of your outdoor session, sport, or active challenge.' }
];

if (!fs.existsSync(specialChallengesDbPath)) {
  fs.writeFileSync(specialChallengesDbPath, JSON.stringify(defaultSpecialChallenges, null, 2));
}

const defaultStatus = { isActive: true, title: 'Fresh challenge campaign started', startedAt: new Date().toISOString(), endedAt: '' };
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
const writeCommunityPosts = (p) => writeJson(communityDbPath, p);
const readSpecialChallenges = () => readJson(specialChallengesDbPath, defaultSpecialChallenges);
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
    const categoryItems = await Promise.all(
      categoryQrConfigurations.map(async (cat) => ({
        ...cat,
        qrCode: await QRCode.toDataURL(cat.code, { margin: 1, width: 420, color: { dark: '#0f172a', light: '#ffffff' } })
      }))
    );
    return [...categoryItems, ...challengeItems];
  } catch (err) {
    console.error("Error generating QR codes:", err);
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

// --- ENDPOINTS PÚBLICOS Y USUARIOS ---
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'wellness-passport-api' }));
app.get('/api/participants', (_req, res) => res.json({ participants: readParticipants().map(sanitizeUser) }));

app.post('/api/register', async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!fullName || !email || !password) return res.status(400).json({ message: 'Missing required fields.' });
    if (!email.endsWith('@roche.com')) return res.status(400).json({ message: 'Use a valid @roche.com email.' });

    const participants = readParticipants();
    if (participants.some((p) => normalizeEmail(p.email) === email)) return res.status(409).json({ message: 'Email already registered.' });

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
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Invalid Roche email or password.' });
    return res.json({ user: sanitizeUser(user) });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

app.post('/api/participants/:id/stamps', (req, res) => {
  try {
    const { id } = req.params;
    const { title, points, method, categoryId, date, scanCode } = req.body;
    const status = readChallengeStatus();
    if (!status || !status.isActive) return res.status(403).json({ message: 'Activity logging is disabled because no campaign is active.' });

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

app.get('/api/challenges', (_req, res) => res.json({ challenges: readSpecialChallenges() }));

// --- ENDPOINTS DEL PORTAL DE ADMINISTRACIÓN ---
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

app.get('/api/admin/qr-codes', async (_req, res) => {
  try {
    const qrCodes = await buildQrCatalog();
    return res.json({ qrCodes, categories: categoryQrConfigurations });
  } catch (err) { return res.status(500).json({ message: 'Unable to generate QR codes', error: err.message }); }
});

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

app.get('/api/admin/challenge-status', (_req, res) => res.json({ status: readChallengeStatus() }));

// ENDPOINT: "Create New Challenge Campaign" / "Start Challenge"
app.post('/api/admin/challenge-status/start', (req, res) => {
  try {
    const status = {
      isActive: true,
      title: String(req.body.title || 'Fresh challenge campaign started').trim(),
      startedAt: new Date().toISOString(),
      endedAt: ''
    };
    writeChallengeStatus(status);
    return res.status(201).json({ status });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ENDPOINT: "End Current Challenge Campaign"
app.post('/api/admin/challenge-status/end', (_req, res) => {
  try {
    writeParticipants([]);
    writeSpecialChallenges([]);
    const status = { isActive: false, title: 'Campaign ended', startedAt: '', endedAt: new Date().toISOString() };
    writeChallengeStatus(status);
    return res.json({ status });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ENDPOINT: "Add Special Activity" / "Create Challenge"
app.post('/api/admin/challenges', (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    if (!title || !description) return res.status(400).json({ message: 'Activity name and description are required.' });

    const challenges = readSpecialChallenges();
    const challenge = {
      id: crypto.randomUUID(),
      title,
      description,
      points: Number(req.body.points || 10),
      scanCode
