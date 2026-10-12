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
    proofPrompt: 'Upload a photo showing your steps challenge progress or movement moment.'
  },
  {
    id: crypto.randomUUID(),
    title: 'Team Energy Boost',
    description: 'Join a team wellness activity and share a photo check-in from the session.',
    points: 10,
    scanCode: 'WELLNESS-CHALLENGE-TEAM',
    proofPrompt: 'Upload a photo of your team workout, class, or group challenge moment.'
  }
];

if (!fs.existsSync(specialChallengesDbPath)) {
  fs.writeFileSync(specialChallengesDbPath, JSON.stringify(defaultSpecialChallenges, null, 2));
}

const defaultChallengeStatus = {
  isActive: true,
  title: 'Fresh challenge campaign started',
  startedAt: new Date().toISOString(),
  endedAt: ''
};

if (!fs.existsSync(challengeStatusPath)) {
  fs.writeFileSync(challengeStatusPath, JSON.stringify(defaultChallengeStatus, null, 2));
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Anti-cache header middleware for mobile WebApp shortcuts
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
const readChallengeStatus = () => readJson(challengeStatusPath, defaultChallengeStatus);
const writeChallengeStatus = (status) => writeJson(challengeStatusPath, status);

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
    console.error('QR Catalog Error:', err);
    return [];
  }
};

const ensureSuperAdmin = async () => {
  const admins = readAdmins();
  const existing = admins.find((admin) => normalizeEmail(admin.email) === SUPERADMIN_EMAIL);

  if (existing) {
    if (existing.role !== 'superadmin') {
      existing.role = 'superadmin';
      writeAdmins(admins);
    }
    return;
  }

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
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'wellness-passport-api' }));
app.get('/api/participants', (_req, res) => res.json({ participants: readParticipants().map(sanitizeUser) }));

app.post('/api/register', async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!fullName || !email || !password) return res.status(400).json({ message: 'Please complete all fields.' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters long.' });

    const participants = readParticipants();
    if (participants.some((p) => normalizeEmail(p.email) === email)) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = { id: crypto.randomUUID(), fullName, email, password: passwordHash, passwordPlain: password, stamps: [] };
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

    const recentActivity = participants
      .flatMap((p) => (p.stamps || []).map((st) => ({ ...st, participantName: p.fullName, participantEmail: p.email })))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);

    const activeParticipants = participants.filter((p) => (p.stamps || []).length > 0).length;

    return res.json({
      stats: {
        totalParticipants,
        totalStamps,
        totalPoints,
        activeParticipants,
        averagePoints: totalParticipants ? Number((totalPoints / totalParticipants).toFixed(1)) : 0,
        categoryBreakdown
      },
      recentActivity
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/challenges', (_req, res) => res.json({ challenges: readSpecialChallenges() }));
app.get('/api/admin/challenge-status', (_req, res) => res.json({ status: readChallengeStatus() }));

app.post('/api/admin/challenge-status/start', (req, res) => {
  try {
    const status = { isActive: true, title: String(req.body.title || 'Fresh challenge campaign started').trim(), startedAt: new Date().toISOString(), endedAt: '' };
    writeChallengeStatus(status);
    return res.status(201).json({ status });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/admin/challenge-status/end', (_req, res) => {
  try {
    writeParticipants([]);
    writeSpecialChallenges([]);
    const status = { isActive: false, title: 'Campaign ended', startedAt: '', endedAt: new Date().toISOString() };
    writeChallengeStatus(status);
    return res.json({ status });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/admin/challenges', (req, res) => {
  try {
    const title = String(req.body.title || req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    const points = Number(req.body.points || 10);
    const scanCode = String(req.body.scanCode || `WELLNESS-SPECIAL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`).trim().toUpperCase();
    const proofPrompt = String(req.body.proofPrompt || 'Upload a photo proof.').trim();

    if (!title || !description) {
      return res.status(400).json({ message: 'Activity name and description are required.' });
    }

    const challenges = readSpecialChallenges();
    const challenge = {
      id: crypto.randomUUID(),
      title,
      description,
      points: Number.isFinite(points) && points > 0 ? points : 10,
      scanCode,
      proofPrompt
    };

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
    return res.json({ deleted: true, count: challenges.length, challenges });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/admin/community', (_req, res) => {
  return res.json({ posts: readCommunityPosts().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

app.post('/api/admin/community', (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    const image = String(req.body.image || '').trim();
    const author = String(req.body.author || 'Community Member').trim();
    const role = String(req.body.role || 'participant').trim();
    const isAnnouncement = Boolean(req.body.isAnnouncement);

    if (!message && !image) {
      return res.status(400).json({ message: 'Message or photo required for community posts.' });
    }

    const posts = readCommunityPosts();
    const post = {
      id: crypto.randomUUID(),
      author: isAnnouncement ? 'Wellness Team' : author,
      role,
      message,
      image,
      isAnnouncement,
      createdAt: new Date().toISOString()
    };

    posts.unshift(post);
    writeCommunityPosts(posts);

    return res.status(201).json({ post, posts });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/participants/:id/stamps', (req, res) => {
  try {
    const { id } = req.params;
    const { title, points, method, categoryId, scanCode } = req.body;
    const status = readChallengeStatus();

    if (!status || !status.isActive) {
      return res.status(403).json({ message: 'Activity logging is disabled because no campaign is active.' });
    }

    const participants = readParticipants();
    const idx = participants.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ message: 'Participant not found.' });

    const cleanCode = String(scanCode || '').trim().toUpperCase();
    let finalTitle = title;
    let finalPoints = Number(points || 1);

    const catalog = [...categoryQrConfigurations, ...readSpecialChallenges()];
    const match = catalog.find((item) => item.code === cleanCode || item.scanCode === cleanCode);
    if (match) {
      finalTitle = match.title;
      finalPoints = Number(match.points || 1);
    }

    const stamp = {
      id: crypto.randomUUID(),
      title: finalTitle || 'Activity Logged',
      points: finalPoints,
      method: method || 'qr',
      categoryId: categoryId || 'general',
      scanCode: cleanCode,
      date: new Date().toISOString()
    };

    participants[idx].stamps = [stamp, ...(participants[idx].stamps || [])];
    writeParticipants(participants);

    return res.json({ user: sanitizeUser(participants[idx]), stamp });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/admin/report', (_req, res) => {
  try {
    const report = readParticipants().map((p) => {
      const stamps = p.stamps || [];
      return {
        id: p.id,
        fullName: p.fullName,
        email: p.email,
        role: p.role || 'participant',
        totalPoints: stamps.reduce((s, st) => s + Number(st.points || 0), 0),
        totalStamps: stamps.length,
        lastActivity: stamps.length ? new Date(stamps[0].date).toLocaleString() : 'No activity'
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints);

    return res.json({ report });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/admin/report/csv', (_req, res) => {
  try {
    const participants = readParticipants();
    const rows = participants.map((p) => [
      p.fullName,
      p.email,
      p.role || 'participant',
      (p.stamps || []).length,
      (p.stamps || []).reduce((s, st) => s + Number(st.points || 0), 0),
      p.stamps?.length ? new Date(p.stamps[0].date).toISOString() : 'No activity'
    ]);

    const csv = [['fullName', 'email', 'role', 'totalStamps', 'totalPoints', 'lastActivity'], ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="wellness-report.csv"');
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

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
