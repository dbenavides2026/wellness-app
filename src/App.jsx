import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import jsQR from 'jsqr';
import {
  Camera,
  CheckCircle2,
  Dumbbell,
  Edit,
  Lock,
  Trash2,
  IdCard,
  LogIn,
  LogOut,
  Mail,
  PlusCircle,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import './App.css';

const CURRENT_USER_KEY = 'wellness-passport-current-user';
const ADMIN_USER_KEY = 'wellness-passport-admin-user';

const categories = [
  {
    id: 'gym',
    title: 'Gym / Solo Workout',
    points: 1,
    iconType: 'dumbbell',
    scanCode: 'WELLNESS-GYM-101',
    proofPrompt: 'Upload a photo of your workout setup or equipment log.'
  },
  {
    id: 'group',
    title: 'Group Fitness Class',
    points: 2,
    iconType: 'users',
    scanCode: 'WELLNESS-GROUP-202',
    proofPrompt: 'Upload a photo of your class attendance or workout scene.'
  },
  {
    id: 'sports',
    title: 'Sports & Outdoor Game',
    points: 2,
    iconType: 'trophy',
    scanCode: 'WELLNESS-SPORTS-303',
    proofPrompt: 'Upload a photo of your activity, match, or hike.'
  }
];

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload;
}

export default function App() {
  const [participants, setParticipants] = useState([]);
  const [adminStats, setAdminStats] = useState({ stats: {}, recentActivity: [] });
  const [adminQrCodes, setAdminQrCodes] = useState([]);
  const [adminReport, setAdminReport] = useState([]);
  const [editingParticipantId, setEditingParticipantId] = useState(null);
  const [editingParticipantDraft, setEditingParticipantDraft] = useState({ fullName: '', email: '', role: 'participant' });
  const [adminCommunityPosts, setAdminCommunityPosts] = useState([]);
  const [adminCommunityDraft, setAdminCommunityDraft] = useState({ message: '', image: '', isAnnouncement: true });
  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityDraft, setCommunityDraft] = useState({ message: '', image: '' });
  const [accountDraft, setAccountDraft] = useState({ fullName: '', email: '', password: '', profileImage: '' });
  const [accountMessage, setAccountMessage] = useState('');
  const [screen, setScreen] = useState('login');
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(CURRENT_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [adminUser, setAdminUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(ADMIN_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [adminLoginForm, setAdminLoginForm] = useState({ email: '', password: '' });
  const [activePortalTab, setActivePortalTab] = useState('passport');
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [adminTab, setAdminTab] = useState('admin');
  const [authMessage, setAuthMessage] = useState('');
  const [passwordRecoveryEmail, setPasswordRecoveryEmail] = useState('');
  const [passwordRecoveryOpen, setPasswordRecoveryOpen] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [specialChallenges, setSpecialChallenges] = useState([]);
  const [challengeStatus, setChallengeStatus] = useState({
    isActive: false,
    title: 'No active challenge',
    startedAt: '',
    endedAt: ''
  });
  const [challengeForm, setChallengeForm] = useState({
    title: '',
    description: '',
    points: 10,
    scanCode: '',
    proofPrompt: ''
  });
  const [editingChallengeId, setEditingChallengeId] = useState(null);
  const [categorySelections, setCategorySelections] = useState({});
  const [scanEntries, setScanEntries] = useState({});
  const [proofs, setProofs] = useState({});
  const [scannerCategoryId, setScannerCategoryId] = useState(null);
  const [scannerError, setScannerError] = useState('');
  const [formError, setFormError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const points = currentUser?.stamps?.reduce((total, stamp) => total + Number(stamp.points || 0), 0) || 0;
  const noCampaignMessage = 'A new challenge campaign has not started yet. Activity logging is disabled until the wellness team creates and activates a campaign.';

  const refreshParticipants = async () => {
    try {
      const response = await fetchJson('/api/participants');
      setParticipants(response.participants || []);
    } catch (error) {
      console.error('Unable to load participant list', error);
    }
  };

  const refreshAdminStats = async () => {
    try {
      const response = await fetchJson('/api/admin/stats');
      setAdminStats(response || { stats: {}, recentActivity: [] });
    } catch (error) {
      console.error('Unable to load admin stats', error);
    }
  };

  const refreshAdminQrCodes = async () => {
    try {
      const response = await fetchJson('/api/admin/qr-codes');
      setAdminQrCodes(response.qrCodes || []);
    } catch (error) {
      console.error('Unable to load QR codes', error);
    }
  };

  const refreshAdminReport = async () => {
    try {
      const response = await fetchJson('/api/admin/report');
      setAdminReport(response.report || []);
    } catch (error) {
      console.error('Unable to load participant report', error);
    }
  };

  const refreshAdminCommunityPosts = async () => {
    try {
      const response = await fetchJson('/api/admin/community');
      const posts = response.posts || [];
      setAdminCommunityPosts(posts);
      setCommunityPosts(posts);
    } catch (error) {
      console.error('Unable to load community posts', error);
    }
  };

  const refreshCommunityPosts = async () => {
    try {
      const response = await fetchJson('/api/admin/community');
      const posts = response.posts || [];
      setCommunityPosts(posts);
      setAdminCommunityPosts(posts);
    } catch (error) {
      console.error('Unable to load community posts', error);
    }
  };

  const refreshSpecialChallenges = async () => {
    try {
      const response = await fetchJson('/api/challenges');
      setSpecialChallenges(response.challenges || []);
    } catch (error) {
      console.error('Unable to load special challenges', error);
    }
  };

  const refreshChallengeStatus = async () => {
    try {
      const response = await fetchJson('/api/admin/challenge-status');
      setChallengeStatus(response.status || {
        isActive: false,
        title: 'No active challenge',
        startedAt: '',
        endedAt: ''
      });
    } catch (error) {
      console.error('Unable to load challenge status', error);
    }
  };

  useEffect(() => {
    refreshParticipants();
    refreshCommunityPosts();
    refreshSpecialChallenges();
    refreshChallengeStatus();
  }, []);

  useEffect(() => {
    if (adminUser) {
      refreshAdminStats();
      refreshAdminQrCodes();
      refreshAdminReport();
      refreshAdminCommunityPosts();
      refreshSpecialChallenges();
      refreshChallengeStatus();
    }
  }, [adminUser]);

  useEffect(() => {
    if (currentUser) {
      refreshCommunityPosts();
      refreshSpecialChallenges();
      refreshChallengeStatus();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
      setAccountDraft({
        fullName: currentUser.fullName || '',
        email: currentUser.email || '',
        password: '',
        profileImage: currentUser.profileImage || ''
      });
      return;
    }
    window.localStorage.removeItem(CURRENT_USER_KEY);
  }, [currentUser]);

  useEffect(() => {
    if (adminUser) {
      window.localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(adminUser));
      return;
    }
    window.localStorage.removeItem(ADMIN_USER_KEY);
  }, [adminUser]);

  useEffect(() => {
    if (currentUser && (screen === 'login' || screen === 'register')) {
      setScreen('dashboard');
    }

    if (adminUser && (screen === 'login' || screen === 'register' || screen === 'admin-login')) {
      setScreen('admin-dashboard');
    }
  }, [currentUser, adminUser, screen]);

  useEffect(() => {
    if (!scannerCategoryId) {
      return undefined;
    }

    let animationFrameId = 0;
    let cancelled = false;

    const stopStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) {
        return;
      }

      if (video.readyState >= 2) {
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        context.drawImage(video, 0
