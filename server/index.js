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

const hikingChallengesDbPath = path.join(dataDir, 'hiking-challenges.json');
const hikingStatusPath = path.join(dataDir, 'hiking-status.json');

const runningChallengesDbPath = path.join(dataDir, 'running-challenges.json');
const runningStatusPath = path.join(dataDir, 'running-status.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
if (!fs.existsSync(adminsDbPath)) fs.writeFileSync(adminsDbPath, JSON.stringify([], null, 2));

if (!fs.existsSync(communityDbPath)) {
  fs.writeFileSync(communityDbPath, JSON.stringify([{
    id: crypto.randomUUID(),
    author: 'Wellness Team',
    role: 'admin',
    message: 'Welcome to the Wellness Community — share wins, workouts, and encouragement with the team.',
    image: '',
    isAnnouncement: true,
    createdAt: new Date().toISOString()
  }], null, 2));
}

const defaultSpecialChallenges = [
  {
    id: crypto.randomUUID(),
    title: '10K Steps Sprint',
    description: 'Complete 10,000 steps across the week and log your movement with proof.',
    points: 10,
    scanCode: 'WELLNESS-CHALLENGE-STEPS',
    proofPrompt: 'Upload a photo showing your steps challenge progress.'
  }
];

if (!fs.existsSync(specialChallengesDbPath)) {
  fs.writeFileSync(specialChallengesDbPath, JSON.stringify(defaultSpecialChallenges, null, 2));
}

if (!fs.existsSync(challengeStatusPath)) {
  fs.writeFileSync(challengeStatusPath, JSON.stringify({ isActive: true, title: 'Active Wellness Challenge Campaign', startedAt: new Date().toISOString(), endedAt: '' }, null, 2));
}

if (!fs.existsSync(hikingChallengesDbPath)) {
  fs.writeFileSync(hikingChallengesDbPath, JSON.stringify([{ id: crypto.randomUUID(), title: 'Summit Peak Hike', description: 'Reach the summit peak and log your check-in code.', points: 15, scanCode: 'HIKING-SUMMIT-101', proofPrompt: 'Upload photo at summit.' }], null, 2));
}

if (!fs.existsSync(hikingStatusPath)) {
  fs.writeFileSync(hikingStatusPath, JSON.stringify({ isActive: true, title: 'Active Hiking Season', startedAt: new Date().toISOString(), endedAt: '' }, null, 2));
}

if (!fs.existsSync(runningChallengesDbPath)) {
  fs.writeFileSync(runningChallengesDbPath, JSON.stringify([{ id: crypto.randomUUID(), title: '5K Morning Run', description: 'Complete a 5K morning run and log your time.', points: 12, scanCode: 'RUNNING-5K-101', proofPrompt: 'Upload a screenshot of your running app.' }], null, 2));
}

if (!fs.existsSync(runningStatusPath)) {
  fs.writeFileSync(runningStatusPath, JSON.stringify({ isActive: true, title: 'Active Running Campaign', startedAt: new Date().toISOString(), endedAt: '' }, null, 2));
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

const readJson = (filePath, fallback = []) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) || fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
};

const readParticipants = () => readJson(dbPath, []);
const writeParticipants = (p) => writeJson(dbPath, p);
const readAdmins = () => readJson(adminsDbPath, []);
const writeAdmins = (a) => writeJson(adminsDbPath, a);
const readCommunityPosts = () => readJson(communityDbPath, []);
const writeCommunityPosts = (posts) => writeJson(communityDbPath, posts);

const readSpecialChallenges = () => readJson(specialChallengesDbPath, defaultSpecialChallenges);
const writeSpecialChallenges = (challenges) => writeJson(specialChallengesDbPath, challenges);
const readChallengeStatus = () => readJson(challengeStatusPath, { isActive: false });
const writeChallengeStatus = (status) => writeJson(challengeStatusPath, status);

const readHikingChallenges = () => readJson(hikingChallengesDbPath, []);
const writeHikingChallenges = (challenges) => writeJson(hikingChallengesDbPath, challenges);
const readHikingStatus = () => readJson(hikingStatusPath, { isActive: false });
const writeHikingStatus = (status) => writeJson(hikingStatusPath, status);

const readRunningChallenges = () => readJson(runningChallengesDbPath, []);
const writeRunningChallenges = (challenges) => writeJson(runningChallengesDbPath, challenges);
const readRunningStatus = () => readJson(runningStatusPath, { isActive: false });
const writeRunningStatus = (status) => writeJson(runningStatusPath, status);

const SUPERADMIN_EMAIL = 'superadmin@wellness.com';
const SUPERADMIN_PASSWORD = 'DigitalPassport*2026';

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, passwordPlain, ...rest } = user;
  return rest;
};

const categoryQrConfigurations = [
  { id: 'gym', categoryId: 'gym', title: 'Gym / Solo Workout', points: 1, code: 'WELLNESS-GYM-101', scanCode: 'WELLNESS-GYM-101', isCategory: true },
  { id: 'group', categoryId: 'group', title: 'Group Fitness Class', points: 2, code: 'WELLNESS-GROUP-202', scanCode: 'WELLNESS-GROUP-202', isCategory: true },
  { id: 'sports', categoryId: 'sports', title: 'Sports & Outdoor Game', points: 2, code: 'WELLNESS-SPORTS-303', scanCode: 'WELLNESS-SPORTS-303', isCategory: true }
];

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const buildQrCatalog = async () => {
  try {
    const special = readSpecialChallenges();
    const hiking = readHikingChallenges();
    const running = readRunningChallenges();

    const specialItems = await Promise.all(special.map(async (ch) => ({ ...ch, code: ch.scanCode, qrCode: await QRCode.toDataURL(ch.scanCode, { margin: 1, width: 420 }) })));
    const hikingItems = await Promise.all(hiking.map(async (ch) => ({ ...ch, title: `[Hiking] ${ch.title}`, code: ch.scanCode, qrCode: await QRCode.toDataURL(ch.scanCode, { margin: 1, width: 420 }) })));
    const runningItems = await Promise.all(running.map(async (ch) => ({ ...ch, title: `[Running] ${ch.title}`, code: ch.scanCode, qrCode: await QRCode.toDataURL(ch.scanCode, { margin: 1, width: 420 }) })));
    const categoryItems = await Promise.all(categoryQrConfigurations.map(async (cat) => ({ ...cat, qrCode: await QRCode.toDataURL(cat.code, { margin: 1, width: 420 }) })));

    return [...categoryItems, ...specialItems, ...hikingItems, ...runningItems];
  } catch (err) {
    console.error('QR Catalog Error:', err);
    return [];
  }
};

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

// API Endpoints
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/participants', (_req, res) => res.json({ participants: readParticipants().map(sanitizeUser) }));

app.post('/api/register', async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!fullName || !email || !password) return res.status(400).json({ message: 'Please complete all fields.' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });

    const participants = readParticipants();
    if (participants.some((p) => normalizeEmail(p.email) === email)) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = { id: crypto.randomUUID(), fullName, email, password: passwordHash, passwordPlain: password, stamps: [], role: 'participant', createdAt: new Date().toISOString() };
    participants.push(user);
    writeParticipants(participants);

    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const user = readParticipants().find((p) => normalizeEmail(p.email) === email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/forgot-password', (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const match = readParticipants().find((p) => normalizeEmail(p.email) === email);
    if (!match) return res.status(404).json({ message: 'User not found.' });

    return res.json({ message: `Password retrieved for ${match.email}`, password: match.passwordPlain || 'Encrypted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.put('/api/participants/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, password, profileImage } = req.body;
    const participants = readParticipants();
    const idx = participants.findIndex((p) => p.id === id);

    if (idx === -1) return res.status(404).json({ message: 'User not found.' });

    if (fullName) participants[idx].fullName = String(fullName).trim();
    if (email) participants[idx].email = normalizeEmail(email);
    if (profileImage !== undefined) participants[idx].profileImage = profileImage;

    if (password && String(password).trim().length >= 6) {
      participants[idx].password = await bcrypt.hash(String(password).trim(), 10);
      participants[idx].passwordPlain = String(password).trim();
    }

    writeParticipants(participants);
    return res.json({ user: sanitizeUser(participants[idx]), message: 'Profile updated.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    await ensureSuperAdmin();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const admin = readAdmins().find((a) => normalizeEmail(a.email) === email);

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ message: 'Invalid admin credentials.' });
    }

    return res.json({ user: sanitizeUser(admin) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/admin/qr-codes', async (_req, res) => {
  try {
    const qrCodes = await buildQrCatalog();
    return res.json({ qrCodes, categories: categoryQrConfigurations });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/admin/stats', (_req, res) => {
  try {
    const participants = readParticipants();
    const totalParticipants = participants.length;
    const totalStamps = participants.reduce((s, p) => s + (p.stamps || []).length, 0);
    const totalPoints = participants.reduce((s, p) => s + (p.stamps || []).reduce((stS, st) => stS + Number(st.points || 0), 0), 0);

    const categoryBreakdown = participants.reduce((b, p) => {
      (p.stamps || []).forEach((st) => {
        const k = st.title || st.categoryId || 'General';
        b[k] = (b[k] || 0) + 1;
      });
      return b;
    }, {});

    return res.json({
      stats: { totalParticipants, totalStamps, totalPoints, activeParticipants: participants.filter((p) => (p.stamps || []).length > 0).length, categoryBreakdown }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// User Management Actions
app.put('/api/admin/participants/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, role } = req.body;
    const participants = readParticipants();
    const idx = participants.findIndex((p) => p.id === id);

    if (idx === -1) return res.status(404).json({ message: 'User not found.' });

    if (fullName) participants[idx].fullName = String(fullName).trim();
    if (email) participants[idx].email = normalizeEmail(email);
    if (role) participants[idx].role = role;

    writeParticipants(participants);
    return res.json({ user: sanitizeUser(participants[idx]), message: 'User updated successfully.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.delete('/api/admin/participants/:id', (req, res) => {
  try {
    const { id } = req.params;
    let participants = readParticipants();
    if (!participants.some((p) => p.id === id)) return res.status(404).json({ message: 'User not found.' });

    participants = participants.filter((p) => p.id !== id);
    writeParticipants(participants);
    return res.json({ message: 'User deleted.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/admin/participants/:id/promote', (req, res) => {
  try {
    const { id } = req.params;
    const participants = readParticipants();
    const idx = participants.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ message: 'User not found.' });

    participants[idx].role = 'admin';
    writeParticipants(participants);
    return res.json({ user: sanitizeUser(participants[idx]), message: 'User promoted to admin.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Manage Wellness Challenge
app.get('/api/challenges', (_req, res) => res.json({ challenges: readSpecialChallenges() }));
app.get('/api/admin/challenge-status', (_req, res) => res.json({ status: readChallengeStatus() }));

app.post('/api/admin/challenge-status/start', (req, res) => {
  try {
    const status = { isActive: true, title: String(req.body.title || 'Active Wellness Challenge Campaign').trim(), startedAt: new Date().toISOString(), endedAt: '' };
    writeChallengeStatus(status);
    return res.status(201).json({ status });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/admin/challenge-status/end', (_req, res) => {
  try {
    const participants = readParticipants().map((p) => ({ ...p, stamps: (p.stamps || []).filter((st) => st.scanCode?.startsWith('HIKING-') || st.scanCode?.startsWith('RUNNING-')) }));
    writeParticipants(participants);

    const status = { isActive: false, title: 'Wellness Challenge Ended', startedAt: '', endedAt: new Date().toISOString() };
    writeChallengeStatus(status);
    return res.json({ status });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/admin/challenges', (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const points = Number(req.body.points || 10);
    const scanCode = String(req.body.scanCode || `WELLNESS-SPECIAL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`).trim().toUpperCase();

    if (!title || !description) return res.status(400).json({ message: 'Title and description required.' });

    const challenges = readSpecialChallenges();
    const challenge = { id: crypto.randomUUID(), title, description, points, scanCode, proofPrompt: 'Upload a photo proof.' };
    challenges.unshift(challenge);
    writeSpecialChallenges(challenges);

    return res.status(201).json({ challenge, challenges });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.delete('/api/admin/challenges/:id', (req, res) => {
  try {
    const challenges = readSpecialChallenges().filter((c) => c.id !== req.params.id);
    writeSpecialChallenges(challenges);
    return res.json({ challenges });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Manage Hiking Club
app.get('/api/hiking-challenges', (_req, res) => res.json({ challenges: readHikingChallenges() }));
app.get('/api/admin/hiking-status', (_req, res) => res.json({ status: readHikingStatus() }));

app.post('/api/admin/hiking-status/start', (req, res) => {
  const status = { isActive: true, title: 'Active Hiking Season', startedAt: new Date().toISOString(), endedAt: '' };
  writeHikingStatus(status);
  return res.status(201).json({ status });
});

app.post('/api/admin/hiking-status/end', (_req, res) => {
  const status = { isActive: false, title: 'Hiking Season Ended', startedAt: '', endedAt: new Date().toISOString() };
  writeHikingStatus(status);
  return res.json({ status });
});

app.post('/api/admin/hiking-challenges', (req, res) => {
  const title = String(req.body
