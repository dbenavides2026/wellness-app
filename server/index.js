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

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
}

if (!fs.existsSync(adminsDbPath)) {
  fs.writeFileSync(adminsDbPath, JSON.stringify([], null, 2));
}

if (!fs.existsSync(communityDbPath)) {
  fs.writeFileSync(communityDbPath, JSON.stringify([
    {
      id: crypto.randomUUID(),
      author: 'Wellness Team',
      role: 'admin',
      message: 'Welcome to the Wellness Community — share wins, workouts, and encouragement with the team.',
      image: '',
      isAnnouncement: true,
      createdAt: new Date().toISOString()
    }
  ], null, 2));
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
  },
  {
    id: crypto.randomUUID(),
    title: 'Outdoor Move',
    description: 'Take part in an outdoor or sport challenge and submit proof of your activity.',
    points: 10,
    scanCode: 'WELLNESS-CHALLENGE-OUTDOOR',
    proofPrompt: 'Upload a photo of your outdoor session, sport, or active challenge.'
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
const writeParticipants = (participants) => writeJson(dbPath, participants);
const readAdmins = () => readJson(adminsDbPath, []);
const writeAdmins = (admins) => writeJson(adminsDbPath, admins);
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
  {
    id: 'gym',
    categoryId: 'gym',
    title: 'Gym / Solo Workout',
    points: 1,
    code: 'WELLNESS-GYM-101',
    scanCode: 'WELLNESS-GYM-101',
    isCategory: true
  },
  {
    id: 'group',
    categoryId: 'group',
    title: 'Group Fitness Class',
    points: 2,
    code: 'WELLNESS-GROUP-202',
    scanCode: 'WELLNESS-GROUP-202',
    isCategory: true
  },
  {
    id: 'sports',
    categoryId: 'sports',
    title: 'Sports & Outdoor Game',
    points: 2,
    code: 'WELLNESS-SPORTS-303',
    scanCode: 'WELLNESS-SPORTS-303',
    isCategory: true
  }
];

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const buildQrCatalog = async () => {
  const specialChallenges = readSpecialChallenges();

  const challengeItems = await Promise.all(
    specialChallenges.map(async (challenge) => ({
      id: challenge.id,
      title: challenge.title,
      points: Number(challenge.points || 10),
      code: challenge.scanCode,
      scanCode: challenge.scanCode,
      isCategory: false,
      qrCode: await QRCode.toDataURL(challenge.scanCode, {
        margin: 1,
        width: 420,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
    }))
  );

  const items = await Promise.all(
    categoryQrConfigurations.map(async (category) => ({
      ...category,
      qrCode: await QRCode.toDataURL(category.code, {
        margin: 1,
        width: 420,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
    }))
  );

  return [...items, ...challengeItems];
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'wellness-passport-api' });
});

app.get('/api/participants', (_req, res) => {
  const participants = readParticipants().map(sanitizeUser);
  res.json({ participants });
});

app.post('/api/register', async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'Please complete all registration fields.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const participants = readParticipants();
    const emailExists = participants.some((person) => normalizeEmail(person.email) === email);

    if (emailExists) {
      return res.status(409).json({ message: 'That email is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: crypto.randomUUID(),
      fullName,
      email,
      password: passwordHash,
      passwordPlain: password,
      stamps: []
    };

    participants.push(user);
    writeParticipants(participants);

    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create the participant profile.', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Enter both email and password.' });
    }

    const participants = readParticipants();
    const match = participants.find((person) => normalizeEmail(person.email) === email);

    if (!match) {
      return res.status(401).json({ message: 'No participant matched that email and password.' });
    }

    const validPassword = await bcrypt.compare(password, match.password);

    if (!validPassword) {
      return res.status(401).json({ message: 'No participant matched that email and password.' });
    }

    if (!match.passwordPlain) {
      match.passwordPlain = password;
      writeParticipants(participants);
    }

    return res.json({ user: sanitizeUser(match) });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to log in.', error: error.message });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ message: 'Enter an email to retrieve your current password.' });
    }

    const participants = readParticipants();
    const match = participants.find((person) => normalizeEmail(person.email) === email);

    if (!match) {
      return res.status(404).json({ message: 'No participant account was found for that email.' });
    }

    if (!match.passwordPlain) {
      return res.status(400).json({ message: 'This password cannot be shown because it was set before password recall was enabled.' });
    }

    return res.json({ email: match.email, password: match.passwordPlain });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to retrieve the current password.', error: error.message });
  }
});

app.post('/api/admin/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ message: 'Enter an admin email to retrieve the current password.' });
    }

    const admins = readAdmins();
    const match = admins.find((admin) => normalizeEmail(admin.email) === email);

    if (!match) {
      return res.status(404).json({ message: 'No admin account was found for that email.' });
    }

    if (!match.passwordPlain) {
      return res.status(400).json({ message: 'This password cannot be shown because it was set before password recall was enabled.' });
    }

    return res.json({ email: match.email, password: match.passwordPlain });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to retrieve the current admin password.', error: error.message });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    await ensureSuperAdmin();

    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Enter both an admin email and password.' });
    }

    const admins = readAdmins();
    const match = admins.find((admin) => normalizeEmail(admin.email) === email);

    if (!match) {
      return res.status(401).json({ message: 'No admin matched that email and password.' });
    }

    const validPassword = await bcrypt.compare(password, match.password);

    if (!validPassword) {
      return res.status(401).json({ message: 'No admin matched that email and password.' });
    }

    if (!match.passwordPlain) {
      match.passwordPlain = password;
      writeAdmins(admins);
    }

    return res.json({ user: sanitizeUser(match) });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to log in as admin.', error: error.message });
  }
});

app.post('/api/admin/participants/:id/promote', async (req, res) => {
  try {
    await ensureSuperAdmin();

    const { id } = req.params;
    const admins = readAdmins();
    const superAdmin = admins.find((admin) => admin.role === 'superadmin');

    if (!superAdmin) {
      return res.status(403).json({ message: 'Only the superadmin can promote users to admin.' });
    }

    const participants = readParticipants();
    const participantIndex = participants.findIndex((person) => person.id === id);

    if (participantIndex === -1) {
      return res.status(404).json({ message: 'Participant not found.' });
    }

    const participant = participants[participantIndex];
    participant.role = 'admin';

    const adminEntry = admins.find((admin) => normalizeEmail(admin.email) === normalizeEmail(participant.email));

    if (adminEntry) {
      adminEntry.fullName = participant.fullName;
      adminEntry.password = participant.password;
      adminEntry.role = 'admin';
      adminEntry.createdAt = adminEntry.createdAt || new Date().toISOString();
      writeParticipants(participants);
      writeAdmins(admins);
      return res.json({
        user: sanitizeUser(adminEntry),
        participant: sanitizeUser(participant),
        message: `${participant.fullName} was promoted to admin.`
      });
    }

    const newAdmin = {
      id: crypto.randomUUID(),
      fullName: participant.fullName,
      email: participant.email,
      password: participant.password,
      role: 'admin',
      createdAt: new Date().toISOString()
    };

    admins.push(newAdmin);
    writeParticipants(participants);
    writeAdmins(admins);

    return res.status(201).json({
      user: sanitizeUser(newAdmin),
      participant: sanitizeUser(participant),
      message: `${participant.fullName} was promoted to admin.`
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to promote the participant to admin.', error: error.message });
  }
});

app.get('/api/admin/qr-codes', async (_req, res) => {
  try {
    const qrCodes = await buildQrCatalog();
    res.json({ qrCodes, categories: categoryQrConfigurations });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to generate QR codes.', error: error.message });
  }
});

app.get('/api/admin/stats', (_req, res) => {
  try {
    const participants = readParticipants();
    const totalParticipants = participants.length;
    const totalStamps = participants.reduce((sum, person) => sum + ((person.stamps || []).length), 0);
    const totalPoints = participants.reduce((sum, person) => {
      const stampPoints = (person.stamps || []).reduce((stampSum, stamp) => stampSum + Number(stamp.points || 0), 0);
      return sum + stampPoints;
    }, 0);

    const categoryBreakdown = participants.reduce((breakdown, person) => {
      (person.stamps || []).forEach((stamp) => {
        const categoryKey = stamp.categoryId || 'unknown';
        breakdown[categoryKey] = (breakdown[categoryKey] || 0) + 1;
      });
      return breakdown;
    }, {});

    const recentActivity = participants
      .flatMap((person) => (person.stamps || []).map((stamp) => ({
        ...stamp,
        participantName: person.fullName,
        participantEmail: person.email
      })))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);

    const activeParticipants = participants.filter((person) => (person.stamps || []).length > 0).length;

    res.json({
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
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load admin dashboard data.', error: error.message });
  }
});

app.put('/api/admin/participants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fullName = String(req.body.fullName || '').trim();
    const email = normalizeEmail(req.body.email);
    const role = String(req.body.role || 'participant').toLowerCase() === 'admin' ? 'admin' : 'participant';

    if (!fullName || !email) {
      return res.status(400).json({ message: 'Full name and email are required.' });
    }

    const participants = readParticipants();
    const participantIndex = participants.findIndex((person) => person.id === id);

    if (participantIndex === -1) {
      return res.status(404).json({ message: 'Participant not found.' });
    }

    const participant = participants[participantIndex];
    const previousEmail = participant.email;
    participant.fullName = fullName;
    participant.email = email;
    participant.role = role;

    writeParticipants(participants);

    const admins = readAdmins();
    const adminMatch = admins.find((admin) => normalizeEmail(admin.email) === normalizeEmail(previousEmail));
    if (adminMatch) {
      adminMatch.fullName = fullName;
      adminMatch.email = email;
      adminMatch.role = role === 'admin' ? 'admin' : adminMatch.role === 'superadmin' ? 'superadmin' : 'participant';
      writeAdmins(admins);
    }

    return res.json({
      user: sanitizeUser(participant),
      message: 'Participant updated successfully.'
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update the participant.', error: error.message });
  }
});

app.delete('/api/admin/participants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const participants = readParticipants();
    const participantIndex = participants.findIndex((person) => person.id === id);

    if (participantIndex === -1) {
      return res.status(404).json({ message: 'Participant not found.' });
    }

    const [removed] = participants.splice(participantIndex, 1);
    writeParticipants(participants);

    const admins = readAdmins();
    const remainingAdmins = admins.filter((admin) => normalizeEmail(admin.email) !== normalizeEmail(removed.email));
    writeAdmins(remainingAdmins);

    return res.json({
      message: `${removed.fullName} was removed successfully.`,
      removed: sanitizeUser(removed)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to delete the participant.', error: error.message });
  }
});

app.get('/api/admin/report', (_req, res) => {
  try {
    const participants = readParticipants();

    const report = participants
      .map((person) => {
        const stamps = person.stamps || [];
        const totalPoints = stamps.reduce((sum, stamp) => sum + Number(stamp.points || 0), 0);
        const lastActivity = stamps.length
          ? new Date(stamps[0].date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
          : 'No activity';

        return {
          id: person.id,
          fullName: person.fullName,
          email: person.email,
          role: person.role || 'participant',
          totalPoints,
          totalStamps: stamps.length,
          lastActivity
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints || b.totalStamps - a.totalStamps);

    return res.json({ report });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to generate participant report.', error: error.message });
  }
});

app.get('/api/admin/report/csv', (_req, res) => {
  try {
    const participants = readParticipants();
    const rows = participants.map((person) => {
      const stamps = person.stamps || [];
      const totalPoints = stamps.reduce((sum, stamp) => sum + Number(stamp.points || 0), 0);
      return {
        fullName: person.fullName,
        email: person.email,
        role: person.role || 'participant',
        totalStamps: stamps.length,
        totalPoints,
        lastActivity: stamps.length ? new Date(stamps[0].date).toISOString() : 'No activity'
      };
    });

    const header = ['fullName', 'email', 'role', 'totalStamps', 'totalPoints', 'lastActivity'];
    const csvRows = [header, ...rows.map((row) => [
      row.fullName,
      row.email,
      row.role,
      row.totalStamps,
      row.totalPoints,
      row.lastActivity
    ])].map((entry) => entry.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="wellness-participants-report.csv"');
    return res.send(csvRows);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to export the participant report.', error: error.message });
  }
});

app.get('/api/challenges', (_req, res) => {
  try {
    const challenges = readSpecialChallenges();
    return res.json({ challenges });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load special challenges.', error: error.message });
  }
});

app.get('/api/admin/challenge-status', (_req, res) => {
  try {
    const status = readChallengeStatus();
    return res.json({ status });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load challenge status.', error: error.message });
  }
});

app.post('/api/admin/challenge-status/start', (req, res) => {
  try {
    const selectedTitle = String(req.body.title || '').trim();
    const nextStatus = {
      isActive: true,
      title: selectedTitle || 'Fresh challenge campaign started',
      startedAt: new Date().toISOString(),
      endedAt: ''
    };

    writeChallengeStatus(nextStatus);
    return res.status(201).json({ status: nextStatus });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to start the challenge.', error: error.message });
  }
});

app.post('/api/admin/challenge-status/end', (_req, res) => {
  try {
    writeParticipants([]);
    writeSpecialChallenges([]);

    const nextStatus = {
      isActive: false,
      title: 'Campaign ended',
      startedAt: '',
      endedAt: new Date().toISOString()
    };

    writeChallengeStatus(nextStatus);
    return res.json({ status: nextStatus });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to end the challenge.', error: error.message });
  }
});

// ADD SPECIAL ACTIVITY
app.post('/api/admin/challenges', (req, res) => {
  try {
    const title = String(req.body.title || req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    const points = Number(req.body.points || 10);
    const providedScanCode = String(req.body.scanCode || '').trim().toUpperCase();
    const scanCode = providedScanCode || `WELLNESS-SPECIAL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const proofPrompt = String(req.body.proofPrompt || '').trim();

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
      proofPrompt: proofPrompt || 'Upload a photo of your challenge progress.'
    };

    challenges.unshift(challenge);
    writeSpecialChallenges(challenges);

    return res.status(201).json({ challenge, challenges });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create the special challenge.', error: error.message });
  }
});

app.put('/api/admin/challenges/:id', (req, res) => {
  try {
    const { id } = req.params;
    const title = String(req.body.title || req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    const points = Number(req.body.points || 10);
    const providedScanCode = String(req.body.scanCode || '').trim().toUpperCase();
    const proofPrompt = String(req.body.proofPrompt || '').trim();

    const challenges = readSpecialChallenges();
    const index = challenges.findIndex((challenge) => challenge.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Special challenge not found.' });
    }

    challenges[index] = {
      ...challenges[index],
      title: title || challenges[index].title,
      description: description || challenges[index].description,
      points: Number.isFinite(points) && points > 0 ? points : challenges[index].points,
      scanCode: providedScanCode || challenges[index].scanCode,
      proofPrompt: proofPrompt || challenges[index].proofPrompt || 'Upload a photo of your challenge progress.'
    };

    writeSpecialChallenges(challenges);
    return res.json({ challenge: challenges[index], challenges });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update the special challenge.', error: error.message });
  }
});

app.delete('/api/admin/challenges/:id', (req, res) => {
  try {
    const { id } = req.params;
    const challenges = readSpecialChallenges();
    const nextChallenges = challenges.filter((challenge) => challenge.id !== id);

    if (nextChallenges.length === challenges.length) {
      return res.status(404).json({ message: 'Special challenge not found.' });
    }

    writeSpecialChallenges(nextChallenges);
    return res.json({ deleted: true, count: nextChallenges.length, challenges: nextChallenges });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to remove the special challenge.', error: error.message });
  }
});

app.get('/api/admin/community', (_req, res) => {
  try {
    const posts = readCommunityPosts().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ posts });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load community posts.', error: error.message });
  }
});

app.post('/api/admin/community', (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    const role = String(req.body.role || 'admin').trim() || 'admin';
    const image = String(req.body.image || '').trim();
    const isAnnouncement = Boolean(req.body.isAnnouncement);
    const author = isAnnouncement || role === 'admin' ? 'Wellness Team' : String(req.body.author || 'Wellness Team').trim() || 'Wellness Team';

    if (!message && !image) {
      return res.status(400).json({ message: 'Community announcement requires text or an image.' });
    }

    const posts = readCommunityPosts();
    const post = {
      id: crypto.randomUUID(),
      author,
      role,
      message,
      image,
      isAnnouncement,
      createdAt: new Date().toISOString()
    };

    posts.unshift(post);
    writeCommunityPosts(posts);
    return res.status(201).json({ post, posts });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to save the community announcement.', error: error.message });
  }
});

app.delete('/api/admin/community/:id', (req, res) => {
  try {
    const { id } = req.params;
    const posts = readCommunityPosts();
    const nextPosts = posts.filter((post) => post.id !== id);
    writeCommunityPosts(nextPosts);
    return res.json({ deleted: true, count: nextPosts.length, posts: nextPosts });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to remove the community post.', error: error.message });
  }
});

app.post('/api/participants/:id/stamps', (req, res) => {
  try {
    const { id } = req.params;
    const { title, points, method, categoryId, date, scanCode } = req.body;
    const parsedPoints = Number(points || 0);

    if (!title || !categoryId) {
      return res.status(400).json({ message: 'Activity details are missing.' });
    }

    const status = readChallengeStatus();
    if (!status || !status.isActive) {
      return res.status(403).json({
        message: 'A new challenge campaign has not started yet. Activity logging is disabled until the wellness team activates a campaign.'
      });
    }

    const participants = readParticipants();
    const participantIndex = participants.findIndex((person) => person.id === id);

    if (participantIndex === -1) {
      return res.status(404).json({ message: 'Participant not found.' });
    }

    const stamp = {
      id: crypto.randomUUID(),
      title,
      points: parsedPoints,
      method: method || 'upload',
      categoryId,
      scanCode: String(scanCode || '').trim().toUpperCase() || '',
      date: date || new Date().toISOString()
    };

    participants[participantIndex].stamps = [stamp, ...(participants[participantIndex].stamps || [])];
    writeParticipants(participants);

    return res.json({ user: sanitizeUser(participants[participantIndex]) });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to save activity.', error: error.message });
  }
});

app.post('/api/participants/:id/reset', (req, res) => {
  try {
    const { id } = req.params;
    const participants = readParticipants();
    const participantIndex = participants.findIndex((person) => person.id === id);

    if (participantIndex === -1) {
      return res.status(404).json({ message: 'Participant not found.' });
    }

    participants[participantIndex].stamps = [];
    writeParticipants(participants);

    return res.json({ user: sanitizeUser(participants[participantIndex]) });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to reset stamps.', error: error.message });
  }
});

// SERVIR FRONTEND ESTÁTICO EN EXPRESS 5
const distPath = path.join(__dirname, '..', 'dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const startServer = async () => {
  await ensureSuperAdmin();
  app.listen(PORT, () => {
    console.log(`Wellness Passport API running on port ${PORT}`);
  });
};

startServer();
