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
  { id: crypto.randomUUID(), title: '10K Steps Sprint', description: 'Complete 10,000 steps across the week.', points: 10, scanCode: 'ROCHE-CHALLENGE-STEPS', proofPrompt: 'Upload a photo.' },
  { id: crypto.randomUUID(), title: 'Team Energy Boost', description: 'Join a team wellness activity.', points: 10, scanCode: 'ROCHE-CHALLENGE-TEAM', proofPrompt: 'Upload a photo.' },
  { id: crypto.randomUUID(), title: 'Outdoor Move', description: 'Take part in an outdoor challenge.', points: 10, scanCode: 'ROCHE-CHALLENGE-OUTDOOR', proofPrompt: 'Upload a photo.' }
];

if (!fs.existsSync(specialChallengesDbPath)) fs.writeFileSync(specialChallengesDbPath, JSON.stringify(defaultSpecialChallenges, null, 2));

const defaultChallengeStatus = { isActive: false, title: 'No active challenge', startedAt: '', endedAt: '' };
if (!fs.existsSync(challengeStatusPath)) fs.writeFileSync(challengeStatusPath, JSON.stringify(defaultChallengeStatus, null, 2));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

const readJson = (filePath, fallback = []) => {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) || fallback; } catch { return fallback; }
};
const writeJson = (filePath, value) => fs.writeFileSync(filePath, JSON.stringify(value, null, 2));

const readParticipants = () => readJson(dbPath, []);
const writeParticipants = (participants) => writeJson(dbPath, participants);
const readAdmins = () => readJson(adminsDbPath, []);
const writeAdmins = (admins) => writeJson(adminsDbPath, admins);
const readCommunityPosts = () => readJson(communityDbPath, []);
const writeCommunityPosts = (posts) => writeJson(communityDbPath, posts);
const readSpecialChallenges = () => readJson(specialChallengesDbPath, defaultSpecialChallenges);
const writeSpecialChallenges = (challenges) => writeJson(specialChallengesDbPath, challenges);
const readChallengeStatus = () => readJson(challengeStatusPath, defaultChallengeStatus);
const writeChallengeStatus = (status) => writeJson(challengeStatusPath, status);

const SUPERADMIN_EMAIL = 'superadmin@roche.com';
const SUPERADMIN_PASSWORD = 'DigitalPassport*2026';

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, passwordPlain, ...rest } = user;
  return rest;
};

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const ensureSuperAdmin = async () => {
  const admins = readAdmins();
  const existing = admins.find((admin) => normalizeEmail(admin.email) === SUPERADMIN_EMAIL);
  if (existing) return;

  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
  admins.push({
    id: crypto.randomUUID(),
    fullName: 'Super Admin',
    email: SUPERADMIN_EMAIL,
    password: passwordHash,
    passwordPlain: SUPERADMIN_PASSWORD,
    role: 'superadmin',
    createdAt: new Date().toISOString()
  });
  writeAdmins(admins);
};

// --- ENDPOINTS API ---
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'wellness-passport-api' }));

app.get('/api/participants', (_req, res) => {
  res.json({ participants: readParticipants().map(sanitizeUser) });
});

app.post('/api/register', async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!fullName || !email || !password) return res.status(400).json({ message: 'Fields missing.' });
    if (!email.endsWith('@roche.com')) return res.status(400).json({ message: 'Use @roche.com email.' });

    const participants = readParticipants();
    if (participants.some((p) => normalizeEmail(p.email) === email)) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = { id: crypto.randomUUID(), fullName, email, password: passwordHash, passwordPlain: password, stamps: [] };
    participants.push(user);
    writeParticipants(participants);

    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const participants = readParticipants();
    const match = participants.find((p) => normalizeEmail(p.email) === email);

    if (!match || !(await bcrypt.compare(password, match.password))) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    return res.json({ user: sanitizeUser(match) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/challenges', (_req, res) => res.json({ challenges: readSpecialChallenges() }));
app.get('/api/admin/community', (_req, res) => res.json({ posts: readCommunityPosts() }));

// --- SERVIR FRONTEND ESTÁTICO DE REACT (COMPATIBLE CON EXPRESS 5) ---
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
