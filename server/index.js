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
const writeParticipants = (p) => writeJson(dbPath, p);
const readAdmins = () => readJson(adminsDbPath, []);
const writeAdmins = (a) => writeJson(adminsDbPath, a);
const readCommunityPosts = () => readJson(communityDbPath, []);
const writeCommunityPosts = (p) => writeJson(communityDbPath, p);
const readSpecialChallenges = () => readJson(specialChallengesDbPath, defaultSpecialChallenges);
const writeSpecialChallenges = (c) => writeJson(specialChallengesDbPath, c);
const readChallengeStatus = () => readJson(challengeStatusPath, defaultChallengeStatus);
const writeChallengeStatus = (s) => writeJson(challengeStatusPath, s);

const SUPERADMIN_EMAIL = 'superadmin@roche.com';
const SUPERADMIN_PASSWORD = 'DigitalPassport*2026';

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, passwordPlain, ...rest } = user;
  return rest;
};

const categoryQrConfigurations = [
  { id: 'gym', title: 'Gym / Solo Workout', points: 1, code: 'ROCHE-GYM-101' },
  { id: 'group', title: 'Group Fitness Class', points: 2, code: 'ROCHE-GROUP-202' },
  { id: 'sports', title: 'Sports & Outdoor Game', points: 2, code: 'ROCHE-SPORTS-303' }
];

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const buildQrCatalog = async () => {
  const specialChallenges = readSpecialChallenges();
  const challengeItems = await Promise.all(specialChallenges.map(async (ch) => ({
    id: ch.id, title: ch.title, points: Number(ch.points || 10), code: ch.scanCode,
    qrCode: await QRCode.toDataURL(ch.scanCode, { margin: 1, width: 420, color: { dark: '#0f172a', light: '#ffffff' } })
  })));
  const items = await Promise.all(categoryQrConfigurations.map(async (cat) => ({
    ...cat, qrCode: await QRCode.toDataURL(cat.code, { margin: 1, width: 420, color: { dark: '#0f172a', light: '#ffffff' } })
  })));
  return [...items, ...challengeItems];
};

const ensureSuperAdmin = async () => {
  const admins = readAdmins();
  const existing = admins.find((admin) => normalizeEmail(admin.email) === SUPERADMIN_EMAIL);
  if (existing) {
    if (existing.role !== 'superadmin') { existing.role = 'superadmin'; writeAdmins(admins); }
    return;
  }
  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
  admins.push({
    id: crypto.randomUUID(), fullName: 'Super Admin', email: SUPERADMIN_EMAIL,
    password: passwordHash, passwordPlain: SUPERADMIN_PASSWORD, role: 'superadmin', createdAt: new Date().toISOString()
  });
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
    if (!fullName || !email || !password) return res.status(400).json({ message: 'Please complete all registration fields.' });
    if (!email.endsWith('@roche.com')) return res.status(400).json({ message: 'Use a valid Roche email ending in @roche.com.' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters long.' });

    const participants = readParticipants();
    if (participants.some((p) => normalizeEmail(p.email) === email)) return res.status(409).json({ message: 'That Roche email is already registered.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = { id: crypto.randomUUID(), fullName, email, password: passwordHash, passwordPlain: password, stamps: [] };
    participants.push(user);
    writeParticipants(participants);
    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) { return res.status(500).json({ message: 'Unable to create participant profile.', error: error.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ message: 'Enter both email and password.' });

    const participants = readParticipants();
    const match = participants.find((p) => normalizeEmail(p.email) === email);
    if (!match || !(await bcrypt.compare(password, match.password))) return res.status(401).json({ message: 'Invalid Roche email or password.' });

    if (!match.passwordPlain) { match.passwordPlain = password; writeParticipants(participants); }
    return res.json({ user: sanitizeUser(match) });
  } catch (error) { return res.status(500).json({ message: 'Unable to log in.', error: error.message }); }
});

app.post('/api/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ message: 'Enter a Roche email.' });
    const participants = readParticipants();
    const match = participants.find((p) => normalizeEmail(p.email) === email);
    if (!match) return res.status(404).json({ message: 'No participant found.' });
    if (!match.passwordPlain) return res.status(400).json({ message: 'Password recall not available.' });
    return res.json({ email: match.email, password: match.passwordPlain });
  } catch (error) { return res.status(500).json({ message: error.message }); }
});

app.post('/api/admin/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ message: 'Enter an admin email.' });
    const admins = readAdmins();
    const match = admins.find((a) => normalizeEmail(a.email) === email);
    if (!match) return res.status(404).json({ message: 'No admin found.' });
    if (!match.passwordPlain) return res.status(400).json({ message: 'Password recall not available.' });
    return res.json({ email: match.email, password: match.passwordPlain });
  } catch (error) { return res.status(500).json({ message: error.message }); }
});

app.post('/api/admin/register', async (req, res) => {
  try {
    await ensureSuperAdmin();
    const fullName = String(req.body.fullName || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const superAdminPassword = String(req.body.superAdminPassword || '');

    if (!fullName || !email || !password) return res.status(400).json({ message: 'Complete all fields.' });
    if (!email.endsWith('@roche.com')) return res.status(400).json({ message: 'Use @roche.com email.' });

    const admins = readAdmins();
    const superAdmin = admins.find((a) => a.role === 'superadmin');
    if (!superAdmin || !(await bcrypt.compare(superAdminPassword, superAdmin.password))) return res.status(403).json({ message: 'Only superadmin can create admin accounts.' });

    if (admins.some((a) => normalizeEmail(a.email) === email)) return res.status(409).json({ message: 'Admin email already exists.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = { id: crypto.randomUUID(), fullName, email, password: passwordHash, passwordPlain: password, role: 'admin', createdAt: new Date().toISOString() };
    admins.push(admin);
    writeAdmins(admins);
    return res.status(201).json({ user: sanitizeUser(admin) });
  } catch (error) { return res.status(500).json({ message: error.message }); }
});

app.post('/api/admin/login', async (req, res) => {
  try
