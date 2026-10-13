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

const initialCommunityPosts = [
  {
    id: crypto.randomUUID(),
    author: 'Wellness Team',
    role: 'admin',
    message: 'Welcome to the Wellness Community! Share your fitness wins and track your progress across all activities.',
    image: '',
    isAnnouncement: true,
    createdAt: new Date().toISOString()
  }
];

if (!fs.existsSync(communityDbPath) || JSON.parse(fs.readFileSync(communityDbPath, 'utf8') || '[]').length === 0) {
  fs.writeFileSync(communityDbPath, JSON.stringify(initialCommunityPosts, null, 2));
}

const defaultSpecialChallenges = [
  {
    id: crypto.randomUUID(),
    title: '10K Steps Sprint',
    description: 'Complete 10,000 steps across the week and log your movement with proof.',
    points: 10,
    scanCode: 'WELLNESS-CHALLENGE-STEPS',
    proofPrompt: 'Upload a picture showing your steps challenge progress or movement moment.'
  }
];

if (!fs.existsSync(specialChallengesDbPath)) {
  fs.writeFileSync(specialChallengesDbPath, JSON.stringify(defaultSpecialChallenges, null, 2));
}

const defaultChallengeStatus = { isActive: true, title: 'Active Wellness Challenge Campaign', startedAt: new Date().toISOString(), endedAt: '' };
if (!fs.existsSync(challengeStatusPath)) fs.writeFileSync(challengeStatusPath, JSON.stringify(defaultChallengeStatus, null, 2));

const defaultHikingChallenges = [
  { id: crypto.randomUUID(), title: 'Summit Peak Hike', description: 'Reach the summit peak and log your check-in code.', points: 15, scanCode: 'HIKING-SUMMIT-101', proofPrompt: 'Upload a picture at the peak summit.' }
];
if (!fs.existsSync(hikingChallengesDbPath)) fs.writeFileSync(hikingChallengesDbPath, JSON.stringify(defaultHikingChallenges, null, 2));

const defaultHikingStatus = { isActive: true, title: 'Active Hiking Season Campaign', startedAt: new Date().toISOString(), endedAt: '' };
if (!fs.existsSync(hikingStatusPath)) fs.writeFileSync(hikingStatusPath, JSON.stringify(defaultHikingStatus, null, 2));

const defaultRunningChallenges = [
  { id: crypto.randomUUID(), title: '5K Morning Run', description: 'Complete a 5K morning run and scan your finish code.', points: 12, scanCode: 'RUNNING-5K-101', proofPrompt: 'Upload a picture from your run.' }
];
if (!fs.existsSync(runningChallengesDbPath)) fs.writeFileSync(runningChallengesDbPath, JSON.stringify(defaultRunningChallenges, null, 2));

const defaultRunningStatus = { isActive: true, title: 'Active Running Season Campaign', startedAt: new Date().toISOString(), endedAt: '' };
if (!fs.existsSync(runningStatusPath)) fs.writeFileSync(runningStatusPath, JSON.stringify(defaultRunningStatus, null, 2));

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
const readCommunityPosts = () => readJson(communityDbPath, initialCommunityPosts);
const writeCommunityPosts = (posts) => writeJson(communityDbPath, posts);
const readSpecialChallenges = () => readJson(specialChallengesDbPath, defaultSpecialChallenges);
const writeSpecialChallenges = (challenges) => writeJson(specialChallengesDbPath, challenges);
const readChallengeStatus = () => readJson(challengeStatusPath, defaultChallengeStatus);
const writeChallengeStatus = (status) => writeJson(challengeStatusPath, status);

const readHikingChallenges = () => readJson(hikingChallengesDbPath, defaultHikingChallenges);
const writeHikingChallenges = (challenges) => writeJson(hikingChallengesDbPath, challenges);
const readHikingStatus = () => readJson(hikingStatusPath, defaultHikingStatus);
const writeHikingStatus = (status) => writeJson(hikingStatusPath, status);

const readRunningChallenges = () => readJson(runningChallengesDbPath, defaultRunningChallenges);
const writeRunningChallenges = (challenges) => writeJson(runningChallengesDbPath, challenges);
const readRunningStatus = () => readJson(runningStatusPath, defaultRunningStatus);
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
  { id: 'sports', categoryId: 'sports', title: 'Sports & Outdoor Game', points: 2, code: 'WELLNESS-SPORTS-303', scanCode: 'WELLNESS-SPORTS-303', isCategory: true },
  { id: 'hiking-club-checkin', categoryId: 'hiking-club-checkin', title: 'Hiking Club Expedition', points: 1, code: 'HIKING-CLUB-101', scanCode: 'HIKING-CLUB-101', isCategory: true },
  { id: 'running-club-checkin', categoryId: 'running-club-checkin', title: 'Running Club Session', points: 1, code: 'RUNNING-CLUB-101', scanCode: 'RUNNING-CLUB-101', isCategory: true }
];

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const generateSingleQr = async (text, darkColor = '#0f172a') => {
  try {
    const codeString = String(text || '').trim();
    if (!codeString) return '';
    return await QRCode.toDataURL(codeString, { margin: 1, width: 420, color: { dark: darkColor, light: '#ffffff' } });
  } catch (err) {
    return '';
  }
};

const buildQrCatalog = async () => {
  const specialChallenges = readSpecialChallenges();
  const hikingChallenges = readHikingChallenges();
  const runningChallenges = readRunningChallenges();

  const categoryItems = await Promise.all(
    categoryQrConfigurations.map(async (cat) => ({ ...cat, code: cat.scanCode, qrCode: await generateSingleQr(cat.scanCode, '#0f172a') }))
  );

  const challengeItems = await Promise.all(
    specialChallenges.map(async (ch) => ({ id: ch.id, title: ch.title, points: Number(ch.points || 10), code: ch.scanCode, scanCode: ch.scanCode, isCategory: false, qrCode: await generateSingleQr(ch.scanCode, '#0f172a') }))
  );

  const hikingItems = await Promise.all(
    hikingChallenges.map(async (ch) => ({ id: ch.id, title: `[Hiking] ${ch.title}`, points: Number(ch.points || 15), code: ch.scanCode, scanCode: ch.scanCode, isCategory: false, qrCode: await generateSingleQr(ch.scanCode, '#15803d') }))
  );

  const runningItems = await Promise.all(
    runningChallenges.map(async (ch) => ({ id: ch.id, title: `[Running] ${ch.title}`, points: Number(ch.points || 12), code: ch.scanCode, scanCode: ch.scanCode, isCategory: false, qrCode: await generateSingleQr(ch.scanCode, '#b45309') }))
  );

  return [...categoryItems, ...challengeItems, ...hikingItems, ...runningItems];
};

const ensureSuperAdmin = async () => {
  const admins = readAdmins();
  const existing = admins.find((admin) => normalizeEmail(admin.email) === SUPERADMIN_EMAIL);
  if (existing) return;

  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
  admins.push({ id: crypto.randomUUID(), fullName: 'Super Admin', email: SUPERADMIN_EMAIL, password: passwordHash, passwordPlain: SUPERADMIN_PASSWORD, role: 'superadmin', createdAt: new Date().toISOString() });
  writeAdmins(admins);
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/participants', (_req, res) => res.json({ participants: readParticipants().map(sanitizeUser) }));

app.get('/api/admin/qr-codes', async (_req, res) => {
  try {
    const qrCodes = await buildQrCatalog();
    return res.json({ qrCodes, categories: categoryQrConfigurations });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Community API
app.get('/api/admin/community', (_req, res) => {
  const posts = readCommunityPosts().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ posts });
});

app.post('/api/admin/community', (req, res) => {
  try {
    const { message, image, author, role, isAnnouncement } = req.body;
    if (!message && !image) return res.status(400).json({ message: 'Message or photo is required.' });

    const posts = readCommunityPosts();
    const post = {
      id: crypto.randomUUID(),
      author: isAnnouncement ? 'Wellness Team' : (author || 'Community Member'),
      role: role || 'participant',
      message: String(message || '').trim(),
      image: String(image || '').trim(),
      isAnnouncement: Boolean(isAnnouncement),
      createdAt: new Date().toISOString()
    };

    posts.unshift(post);
    writeCommunityPosts(posts);
    return res.status(201).json({ post, posts });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.put('/api/admin/community/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { message, image } = req.body;
    const posts = readCommunityPosts();
    const idx = posts.findIndex((p) => p.id === id);

    if (idx === -1) return res.status(404).json({ message: 'Post not found.' });

    if (message !== undefined) posts[idx].message = String(message).trim();
    if (image !== undefined) posts[idx].image = String(image).trim();

    writeCommunityPosts(posts);
    return res.json({ post: posts[idx], posts, message: 'Community post updated.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.delete('/api/admin/community/:id', (req, res) => {
  try {
    let posts = readCommunityPosts();
    posts = posts.filter((p) => p.id !== req.params.id);
    writeCommunityPosts(posts);
    return res.json({ deleted: true, posts, message: 'Community post removed.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Campaign Management
app.get('/api/admin/challenge-status', (_req, res) => res.json({ status: readChallengeStatus() }));
app.get('/api/admin/hiking-status', (_req, res) => res.json({ status: readHikingStatus() }));
app.get('/api/admin/running-status', (_req, res) => res.json({ status: readRunningStatus() }));

app.post('/api/admin/challenge-status/start', (req, res) => {
  const status = { isActive: true, title: String(req.body.title || 'Active Wellness Challenge Campaign').trim(), startedAt: new Date().toISOString(), endedAt: '' };
  writeChallengeStatus(status);
  return res.status(201).json({ status });
});

app.post('/api/admin/challenge-status/end', (_req, res) => {
  const participants = readParticipants().map((p) => ({
    ...p,
    stamps: (p.stamps || []).filter((s) => s.scanCode?.startsWith('HIKING-') || s.scanCode?.startsWith('RUNNING-'))
  }));
  writeParticipants(participants);
  const status = { isActive: false, title: 'Wellness Campaign Ended', startedAt: '', endedAt: new Date().toISOString() };
  writeChallengeStatus(status);
  return res.json({ status });
});

app.post('/api/admin/hiking-status/start', (req, res) => {
  const status = { isActive: true, title: String(req.body.title || 'Active Hiking Season Campaign').trim(), startedAt: new Date().toISOString(), endedAt: '' };
  writeHikingStatus(status);
  return res.status(201).json({ status });
});

app.post('/api/admin/hiking-status/end', (_req, res) => {
  const participants = readParticipants().map((p) => ({
    ...p,
    stamps: (p.stamps || []).filter((s) => !s.scanCode?.startsWith('HIKING-'))
  }));
  writeParticipants(participants);
  const status = { isActive: false, title: 'Hiking Season Ended', startedAt: '', endedAt: new Date().toISOString() };
  writeHikingStatus(status);
  return res.json({ status });
});

app.post('/api/admin/running-status/start', (req, res) => {
  const status = { isActive: true, title: String(req.body.title || 'Active Running Season Campaign').trim(), startedAt: new Date().toISOString(), endedAt: '' };
  writeRunningStatus(status);
  return res.status(201).json({ status });
});

app.post('/api/admin/running-status/end', (_req, res) => {
  const participants = readParticipants().map((p) => ({
    ...p,
    stamps: (p.stamps || []).filter((s) => !s.scanCode?.startsWith('RUNNING-'))
  }));
  writeParticipants(participants);
  const status = { isActive: false, title: 'Running Season Ended', startedAt: '', endedAt: new Date().toISOString() };
  writeRunningStatus(status);
  return res.json({ status });
});

app.post('/api/admin/challenges', async (req, res) => {
  const { title, description, points, scanCode, proofPrompt } = req.body;
  if (!title || !description) return res.status(400).json({ message: 'Title and description required.' });

  const finalScanCode = String(scanCode || `WELLNESS-SPECIAL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`).trim().toUpperCase();
  const challenges = readSpecialChallenges();
  const challenge = { id: crypto.randomUUID(), title: String(title).trim(), description: String(description).trim(), points: Number(points) || 10, scanCode: finalScanCode, proofPrompt: String(proofPrompt || 'Upload a picture proof.').trim() };
  challenges.unshift(challenge);
  writeSpecialChallenges(challenges);
  return res.status(201).json({ challenge, challenges });
});

app.post('/api/admin/hiking-challenges', async (req, res) => {
  const { title, description, points, scanCode, proofPrompt } = req.body;
  if (!title || !description) return res.status(400).json({ message: 'Title and description required.' });

  const finalScanCode = String(scanCode || `HIKING-SPECIAL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`).trim().toUpperCase();
  const challenges = readHikingChallenges();
  const challenge = { id: crypto.randomUUID(), title: String(title).trim(), description: String(description).trim(), points: Number(points) || 15, scanCode: finalScanCode, proofPrompt: String(proofPrompt || 'Upload a picture proof.').trim() };
  challenges.unshift(challenge);
  writeHikingChallenges(challenges);
  return res.status(201).json({ challenge, challenges });
});

app.post('/api/admin/running-challenges', async (req, res) => {
  const { title, description, points, scanCode, proofPrompt } = req.body;
  if (!title || !description) return res.status(400).json({ message: 'Title and description required.' });

  const finalScanCode = String(scanCode || `RUNNING-SPECIAL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`).trim().toUpperCase();
  const challenges = readRunningChallenges();
  const challenge = { id: crypto.randomUUID(), title: String(title).trim(), description: String(description).trim(), points: Number(points) || 12, scanCode: finalScanCode, proofPrompt: String(proofPrompt || 'Upload a picture proof.').trim() };
  challenges.unshift(challenge);
  writeRunningChallenges(challenges);
  return res.status(201).json({ challenge, challenges });
});

app.get('/api/challenges', (_req, res) => res.json({ challenges: readSpecialChallenges() }));
app.get('/api/hiking-challenges', (_req, res) => res.json({ challenges: readHikingChallenges() }));
app.get('/api/running-challenges', (_req, res) => res.json({ challenges: readRunningChallenges() }));

app.delete('/api/admin/challenges/:id', (req, res) => {
  const challenges = readSpecialChallenges().filter((c) => c.id !== req.params.id);
  writeSpecialChallenges(challenges);
  return res.json({ deleted: true, challenges });
});

app.delete('/api/admin/hiking-challenges/:id', (req, res) => {
  const challenges = readHikingChallenges().filter((c) => c.id !== req.params.id);
  writeHikingChallenges(challenges);
  return res.json({ deleted: true, challenges });
});

app.delete('/api/admin/running-challenges/:id', (req, res) => {
  const challenges = readRunningChallenges().filter((c) => c.id !== req.params.id);
  writeRunningChallenges(challenges);
  return res.json({ deleted: true, challenges });
});

app.put('/api/participants/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, password, profileImage } = req.body;
    const participants = readParticipants();
    const idx = participants.findIndex((p) => p.id === id);

    if (idx === -1) return res.status(404).json({ message: 'Participant not found.' });

    if (fullName) participants[idx].fullName = String(fullName).trim();
    if (email) participants[idx].email = normalizeEmail(email);
    if (profileImage !== undefined) participants[idx].profileImage = profileImage;

    if (password && String(password).trim().length >= 6) {
      participants[idx].password = await bcrypt.hash(String(password).trim(), 10);
    }

    writeParticipants(participants);
    return res.json({ user: sanitizeUser(participants[idx]), message: 'Profile updated successfully.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!fullName || !email || !password) return res.status(400).json({ message: 'Please complete all fields.' });
    const participants = readParticipants();
    if (participants.some((p) => normalizeEmail(p.email) === email)) return res.status(409).json({ message: 'Email already registered.' });

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

app.get('/api/admin/stats', (_req, res) => {
  try {
    const participants = readParticipants();
    const totalParticipants = participants.length;
    const totalStamps = participants.reduce((s, p) => s + (p.stamps || []).length, 0);
    const totalPoints = participants.reduce((s, p) => s + (p.stamps || []).reduce((stS, st) => stS + Number(st.points || 0), 0), 0);

    return res.json({
      stats: { totalParticipants, totalStamps, totalPoints, activeParticipants: participants.filter((p) => (p.stamps || []).length > 0).length }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

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
    let participants = readParticipants();
    participants = participants.filter((p) => p.id !== req.params.id);
    writeParticipants(participants);
    return res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/admin/participants/:id/promote', (req, res) => {
  try {
    const participants = readParticipants();
    const idx = participants.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Participant not found.' });

    participants[idx].role = 'admin';
    writeParticipants(participants);
    return res.json({ user: sanitizeUser(participants[idx]), message: `${participants[idx].fullName} assigned as admin.` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/participants/:id/stamps', (req, res) => {
  try {
    const { id } = req.params;
    const { title, points, method, categoryId, scanCode } = req.body;

    const wellnessStatus = readChallengeStatus();
    const hikingStatus = readHikingStatus();
    const runningStatus = readRunningStatus();

    const cleanCode = String(scanCode || '').trim().toUpperCase();
    const isHikingCode = cleanCode.startsWith('HIKING-');
    const isRunningCode = cleanCode.startsWith('RUNNING-');

    if (isHikingCode && (!hikingStatus || !hikingStatus.isActive)) return res.status(403).json({ message: 'Hiking campaign is inactive.' });
    if (isRunningCode && (!runningStatus || !runningStatus.isActive)) return res.status(403).json({ message: 'Running campaign is inactive.' });
    if (!isHikingCode && !isRunningCode && (!wellnessStatus || !wellnessStatus.isActive)) return res.status(403).json({ message: 'Wellness campaign is inactive.' });

    const participants = readParticipants();
    const idx = participants.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ message: 'Participant not found.' });

    let finalTitle = title;
    let finalPoints = Number(points || 1);

    const catalog = [...categoryQrConfigurations, ...readSpecialChallenges(), ...readHikingChallenges(), ...readRunningChallenges()];
    const match = catalog.find((item) => item.code === cleanCode || item.scanCode === cleanCode);
    if (match) {
      finalTitle = match.title;
      finalPoints = Number(match.points || 1);
    }

    const stamp = { id: crypto.randomUUID(), title: finalTitle || 'Activity Logged', points: finalPoints, method: method || 'qr', categoryId: categoryId || 'general', scanCode: cleanCode, date: new Date().toISOString() };
    participants[idx].stamps = [stamp, ...(participants[idx].stamps || [])];
    writeParticipants(participants);

    return res.json({ user: sanitizeUser(participants[idx]), stamp });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/admin/report', (_req, res) => {
  const report = readParticipants().map((p) => {
    const stamps = p.stamps || [];
    return { id: p.id, fullName: p.fullName, email: p.email, role: p.role || 'participant', totalPoints: stamps.reduce((s, st) => s + Number(st.points || 0), 0), totalStamps: stamps.length, lastActivity: stamps.length ? new Date(stamps[0].date).toLocaleString() : 'No activity' };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
  return res.json({ report });
});

app.get('/api/admin/report/csv', (_req, res) => {
  const participants = readParticipants();
  const rows = participants.map((p) => [p.fullName, p.email, p.role || 'participant', (p.stamps || []).length, (p.stamps || []).reduce((s, st) => s + Number(st.points || 0), 0), p.stamps?.length ? new Date(p.stamps[0].date).toISOString() : 'No activity']);
  const csv = [['fullName', 'email', 'role', 'totalStamps', 'totalPoints', 'lastActivity'], ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="wellness-report.csv"');
  return res.send(csv);
});

// Servir cliente de React en Express con encabezados Anti-Cache para HTML

const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

const startServer = async () => {
  await ensureSuperAdmin();
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
};

startServer();
