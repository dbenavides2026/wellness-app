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
  RotateCcw,
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
    scanCode: 'ROCHE-GYM-101',
    proofPrompt: 'Upload a photo of your workout setup or equipment log.'
  },
  {
    id: 'group',
    title: 'Group Fitness Class',
    points: 2,
    iconType: 'users',
    scanCode: 'ROCHE-GROUP-202',
    proofPrompt: 'Upload a photo of your class attendance or workout scene.'
  },
  {
    id: 'sports',
    title: 'Sports & Outdoor Game',
    points: 2,
    iconType: 'trophy',
    scanCode: 'ROCHE-SPORTS-303',
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
  const [adminRegisterForm, setAdminRegisterForm] = useState({
    fullName: '',
    email: '',
    password: '',
    superAdminPassword: ''
  });
  const [activePortalTab, setActivePortalTab] = useState('passport');
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [adminTab, setAdminTab] = useState('admin');
  const [authMessage, setAuthMessage] = useState('');
  const [passwordRecoveryEmail, setPasswordRecoveryEmail] = useState('');
  const [passwordRecoveryOpen, setPasswordRecoveryOpen] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminRegistrationMessage, setAdminRegistrationMessage] = useState('');
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

    if (adminUser && (screen === 'login' || screen === 'register' || screen === 'admin-login' || screen === 'admin-register')) {
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
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (decoded) {
          const scannedValue = decoded.data.trim().toUpperCase();
          setScanEntries((prev) => ({
            ...prev,
            [scannerCategoryId]: scannedValue
          }));
          setCategorySelections((prev) => ({
            ...prev,
            [scannerCategoryId]: { method: 'scan' }
          }));
          stopStream();
          setScannerCategoryId(null);
          setScannerError('');
          return;
        }
      }

      if (!cancelled) {
        animationFrameId = window.requestAnimationFrame(scanFrame);
      }
    };

    const startScanner = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('This device does not support camera scanning.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment'
          },
          audio: false
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        scanFrame();
      } catch (error) {
        if (!cancelled) {
          setScannerError(error.message || 'Unable to access the camera.');
          setScannerCategoryId(null);
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrameId);
      stopStream();
    };
  }, [scannerCategoryId]);

  const handleLogin = async (event) => {
    event.preventDefault();
    const email = loginForm.email.trim().toLowerCase();
    const password = loginForm.password;

    if (!email || !password) {
      setAuthMessage('Enter both your Roche email and password.');
      return;
    }

    try {
      const response = await fetchJson('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      setCurrentUser(response.user);
      setAuthMessage('');
      setRegistrationMessage('');
      setFormError('');
      setScreen('dashboard');
      await refreshParticipants();
    } catch (error) {
      setAuthMessage(error.message || 'Unable to log in.');
    }
  };

  const handleForgotPassword = async () => {
    const email = passwordRecoveryEmail.trim().toLowerCase();

    if (!email) {
      setAuthMessage('Enter your Roche email to retrieve your current password.');
      return;
    }

    try {
      const response = await fetchJson('/api/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });

      setAuthMessage(`Your current password is: ${response.password}`);
      setLoginForm((prev) => ({ ...prev, email, password: response.password }));
      setPasswordRecoveryOpen(false);
      setPasswordRecoveryEmail('');
    } catch (error) {
      setAuthMessage(error.message || 'Unable to retrieve your password.');
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    const fullName = registerForm.fullName.trim();
    const email = registerForm.email.trim().toLowerCase();
    const password = registerForm.password;
    const confirmPassword = registerForm.confirmPassword;

    if (!fullName || !email || !password || !confirmPassword) {
      setRegistrationMessage('Please complete all fields.');
      return;
    }

    if (!email.endsWith('@roche.com')) {
      setRegistrationMessage('Use a valid Roche email ending in @roche.com.');
      return;
    }

    if (password.length < 6) {
      setRegistrationMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setRegistrationMessage('Passwords do not match. Please re-enter the same password in both fields.');
      return;
    }

    try {
      await fetchJson('/api/register', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, password })
      });

      const successMessage = 'Registration successful. Please log in with your Roche email and password.';

      setRegisterForm({ fullName: '', email: '', password: '', confirmPassword: '' });
      setLoginForm({ email: '', password: '' });
      setAuthMessage('');
      setRegistrationMessage('');
      setScreen('login');
      setAuthMessage(successMessage);
      await refreshParticipants();
    } catch (error) {
      setRegistrationMessage(error.message || 'Unable to register this participant.');
      setAuthMessage('');
    }
  };

  const handleAdminLogin = async (event) => {
    event.preventDefault();
    const email = adminLoginForm.email.trim().toLowerCase();
    const password = adminLoginForm.password;

    if (!email || !password) {
      setAdminMessage('Enter both your admin email and password.');
      return;
    }

    try {
      const response = await fetchJson('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      setAdminUser(response.user);
      setAdminMessage('');
      setAdminRegistrationMessage('');
      setScreen('admin-dashboard');
    } catch (error) {
      setAdminMessage(error.message || 'Unable to log in as admin.');
    }
  };

  const handleAdminRegister = async (event) => {
    event.preventDefault();
    const fullName = adminRegisterForm.fullName.trim();
    const email = adminRegisterForm.email.trim().toLowerCase();
    const password = adminRegisterForm.password;
    const superAdminPassword = adminRegisterForm.superAdminPassword;

    if (!fullName || !email || !password || !superAdminPassword) {
      setAdminRegistrationMessage('Please complete all required admin fields and provide the superadmin password.');
      return;
    }

    if (!email.endsWith('@roche.com')) {
      setAdminRegistrationMessage('Use a valid Roche email ending in @roche.com.');
      return;
    }

    if (password.length < 6) {
      setAdminRegistrationMessage('Password must be at least 6 characters long.');
      return;
    }

    try {
      await fetchJson('/api/admin/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          password,
          superAdminPassword
        })
      });

      setAdminRegisterForm({
        fullName: '',
        email: '',
        password: '',
        superAdminPassword: ''
      });
      setAdminLoginForm({ email, password });
      setAdminRegistrationMessage('Admin account created successfully. You can now log in.');
      setScreen('admin-login');
    } catch (error) {
      setAdminRegistrationMessage(error.message || 'Unable to create this admin account.');
    }
  };

  const promoteParticipantToAdmin = async (participant) => {
    if (!adminUser || adminUser.role !== 'superadmin') {
      setAdminMessage('Only the superadmin can promote a participant to admin.');
      return;
    }

    try {
      const response = await fetchJson(`/api/admin/participants/${participant.id}/promote`, {
        method: 'POST',
        body: JSON.stringify({})
      });

      setAdminMessage(response.message || `${participant.fullName} was promoted to admin.`);
      await refreshParticipants();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to promote this participant to admin.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setScreen('login');
    setAuthMessage('');
    setFormError('');
    setProofs({});
    setScanEntries({});
    setCategorySelections({});
  };

  const handleAdminLogout = () => {
    setAdminUser(null);
    setScreen('login');
    setAdminMessage('');
  };

  const handleCommunityImageUpload = (file) => {
    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setCommunityDraft((prev) => ({ ...prev, image: previewUrl }));
  };

  const handleCommunityPostSubmit = () => {
    const message = communityDraft.message.trim();

    if (!message && !communityDraft.image) {
      return;
    }

    const author = currentUser?.fullName || adminUser?.fullName || 'Community Member';
    const role = currentUser ? 'participant' : adminUser?.role || 'participant';

    setCommunityPosts((prev) => [
      {
        id: Date.now(),
        author,
        role,
        message,
        image: communityDraft.image,
        createdAt: 'Just now'
      },
      ...prev
    ]);

    setCommunityDraft({ message: '', image: '', isAnnouncement: false });
  };

  const handleAdminCommunityPostSubmit = async () => {
    const message = adminCommunityDraft.message.trim();

    if (!message) {
      setAdminMessage('Add a message to publish an announcement or community update.');
      return;
    }

    try {
      await fetchJson('/api/admin/community', {
        method: 'POST',
        body: JSON.stringify({
          author: 'Roche Wellness Team',
          role: adminUser?.role || 'admin',
          message,
          image: adminCommunityDraft.image,
          isAnnouncement: adminCommunityDraft.isAnnouncement
        })
      });

      setAdminCommunityDraft({ message: '', image: '', isAnnouncement: true });
      setAdminMessage('Community update published successfully.');
      await refreshCommunityPosts();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to save the community update.');
    }
  };

  const resetChallengeForm = () => {
    setChallengeForm({ title: '', description: '', points: 10, scanCode: '', proofPrompt: '' });
    setEditingChallengeId(null);
  };

  const generateAutoScanCode = () => `ROCHE-SPECIAL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const handleSaveSpecialChallenge = async () => {
    const title = challengeForm.title.trim();
    const description = challengeForm.description.trim();
    const scanCode = (challengeForm.scanCode || '').trim().toUpperCase() || generateAutoScanCode();

    if (!title || !description) {
      setAdminMessage('The activity name and description are required.');
      return;
    }

    try {
      const method = editingChallengeId ? 'PUT' : 'POST';
      const url = editingChallengeId ? `/api/admin/challenges/${editingChallengeId}` : '/api/admin/challenges';

      await fetchJson(url, {
        method,
        body: JSON.stringify({
          ...challengeForm,
          points: Number(challengeForm.points) || 10,
          scanCode,
          proofPrompt: challengeForm.proofPrompt.trim() || 'Upload a photo of your challenge progress.'
        })
      });

      setAdminMessage(editingChallengeId ? 'Special challenge updated successfully.' : 'Special challenge created successfully.');
      resetChallengeForm();

      if (typeof window !== 'undefined') {
        if (adminUser) {
          window.localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(adminUser));
        }
        if (currentUser) {
          window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
        }
      }

      await refreshSpecialChallenges();
      await refreshAdminQrCodes();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to save the special challenge.');
    }
  };

  const handleEditChallenge = (challenge) => {
    setEditingChallengeId(challenge.id);
    setChallengeForm({
      title: challenge.title,
      description: challenge.description,
      points: Number(challenge.points) || 10,
      scanCode: challenge.scanCode,
      proofPrompt: challenge.proofPrompt || ''
    });
  };

  const handleStartChallenge = async () => {
    try {
      const response = await fetchJson('/api/admin/challenge-status/start', {
        method: 'POST',
        body: JSON.stringify({ title: 'Fresh challenge campaign started' })
      });

      setChallengeStatus(response.status || challengeStatus);
      setAdminMessage('New challenge campaign started successfully.');
      setSelectedChallenge(null);
      await refreshParticipants();
      await refreshAdminReport();
      await refreshSpecialChallenges();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to start the challenge.');
    }
  };

  const handleEndChallenge = async () => {
    try {
      const response = await fetchJson('/api/admin/challenge-status/end', { method: 'POST' });
      setChallengeStatus(response.status || challengeStatus);
      setAdminMessage('Current challenge campaign has been ended.');
      setSelectedChallenge(null);
      await refreshParticipants();
      await refreshAdminReport();
      await refreshSpecialChallenges();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to end the challenge.');
    }
  };

  const handleDeleteChallenge = async (challengeId) => {
    try {
      await fetchJson(`/api/admin/challenges/${challengeId}`, { method: 'DELETE' });
      setAdminMessage('Special challenge removed successfully.');
      if (editingChallengeId === challengeId) {
        resetChallengeForm();
      }
      await refreshSpecialChallenges();
      await refreshAdminQrCodes();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to remove this special challenge.');
    }
  };

  const handleDeleteCommunityPost = async (postId) => {
    try {
      await fetchJson(`/api/admin/community/${postId}`, { method: 'DELETE' });
      await refreshAdminCommunityPosts();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to remove this item.');
    }
  };

  const handleDeleteParticipant = async (participantId) => {
    if (!window.confirm('Delete this participant? This action cannot be undone.')) {
      return;
    }

    try {
      await fetchJson(`/api/admin/participants/${participantId}`, { method: 'DELETE' });
      setEditingParticipantId(null);
      setEditingParticipantDraft({ fullName: '', email: '', role: 'participant' });
      await refreshParticipants();
      await refreshAdminStats();
      await refreshAdminReport();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to delete this participant.');
    }
  };

  const handleEditParticipant = (participant) => {
    setEditingParticipantId(participant.id);
    setEditingParticipantDraft({
      fullName: participant.fullName || '',
      email: participant.email || '',
      role: participant.role || 'participant'
    });
  };

  const handleSaveParticipant = async () => {
    if (!editingParticipantId) {
      return;
    }

    const fullName = editingParticipantDraft.fullName.trim();
    const email = editingParticipantDraft.email.trim().toLowerCase();
    const role = editingParticipantDraft.role === 'admin' ? 'admin' : 'participant';

    if (!fullName || !email) {
      setAdminMessage('Full name and Roche email are required.');
      return;
    }

    if (!email.endsWith('@roche.com')) {
      setAdminMessage('Use a valid Roche email ending in @roche.com.');
      return;
    }

    try {
      await fetchJson(`/api/admin/participants/${editingParticipantId}`, {
        method: 'PUT',
        body: JSON.stringify({ fullName, email, role })
      });

      setEditingParticipantId(null);
      setEditingParticipantDraft({ fullName: '', email: '', role: 'participant' });
      setAdminMessage('Participant updated successfully.');
      await refreshParticipants();
      await refreshAdminStats();
      await refreshAdminReport();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to update this participant.');
    }
  };

  const handleProfileImageUpload = (file) => {
    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAccountDraft((prev) => ({ ...prev, profileImage: previewUrl }));
  };

  const handleProfileSave = () => {
    if (!currentUser) {
      return;
    }

    const nextUser = {
      ...currentUser,
      fullName: accountDraft.fullName.trim() || currentUser.fullName,
      email: accountDraft.email.trim() || currentUser.email,
      profileImage: accountDraft.profileImage || currentUser.profileImage || ''
    };

    if (accountDraft.password.trim()) {
      nextUser.password = accountDraft.password.trim();
    }

    setCurrentUser(nextUser);
    setAccountMessage('Profile updated successfully.');
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(nextUser));
  };

  const handleProofUpload = (categoryId, file) => {
    if (!file) {
      return;
    }

    setCategorySelections((prev) => ({
      ...prev,
      [categoryId]: { method: 'upload' }
    }));

    const previewUrl = URL.createObjectURL(file);
    setProofs((prev) => ({
      ...prev,
      [categoryId]: previewUrl
    }));
  };

  const addStamp = async (category) => {
    if (!currentUser) {
      return;
    }

    try {
      const statusResponse = await fetchJson('/api/admin/challenge-status');
      const liveStatus = statusResponse?.status || { isActive: false };
      setChallengeStatus(liveStatus);

      if (!liveStatus.isActive) {
        setFormError(noCampaignMessage);
        return;
      }
    } catch (error) {
      setFormError(noCampaignMessage);
      return;
    }

    const method = categorySelections[category.id]?.method || 'upload';
    const scanValue = (scanEntries[category.id] || '').trim().toUpperCase();

    if (method === 'scan') {
      if (!scanValue) {
        setFormError('Please scan or enter the gym code before logging this activity.');
        return;
      }

      if (scanValue !== category.scanCode) {
        setFormError('That scan code does not match this category.');
        return;
      }
    } else if (!proofs[category.id]) {
      setFormError('Upload a photo proof before logging this activity.');
      return;
    }

    try {
      const response = await fetchJson(`/api/participants/${currentUser.id}/stamps`, {
        method: 'POST',
        body: JSON.stringify({
          title: category.title,
          points: category.points,
          method,
          categoryId: category.id,
          scanCode: method === 'scan' ? scanValue : '',
          date: new Date().toISOString()
        })
      });

      setCurrentUser(response.user);
      setFormError('');
      setProofs((prev) => {
        const next = { ...prev };
        delete next[category.id];
        return next;
      });
      setScanEntries((prev) => {
        const next = { ...prev };
        delete next[category.id];
        return next;
      });
      confetti({
        particleCount: 55,
        spread: 60,
        origin: { y: 0.8 }
      });
    } catch (error) {
      setFormError(error.message || 'Unable to save this activity.');
    }
  };

  const resetTracker = async () => {
    if (!currentUser) {
      return;
    }

    try {
      const response = await fetchJson(`/api/participants/${currentUser.id}/reset`, {
        method: 'POST'
      });

      setCurrentUser(response.user);
      setProofs({});
      setScanEntries({});
      setCategorySelections({});
      setFormError('');
    } catch (error) {
      setFormError(error.message || 'Unable to reset your activities.');
    }
  };

  const getStampBadge = (title) => {
    const normalized = String(title || '').toLowerCase();

    if (normalized.includes('challenge') || normalized.includes('sprint') || normalized.includes('boost') || normalized.includes('outdoor') || normalized.includes('move')) {
      return { Icon: Sparkles, background: 'rgba(245, 158, 11, 0.12)', color: '#b45309' };
    }

    if (normalized.includes('gym') || normalized.includes('workout')) {
      return { Icon: Dumbbell, background: 'rgba(11, 65, 205, 0.12)', color: '#0b41cd' };
    }

    if (normalized.includes('sport') || normalized.includes('outdoor') || normalized.includes('game')) {
      return { Icon: Trophy, background: 'rgba(11, 65, 205, 0.10)', color: '#0b41cd' };
    }

    return { Icon: Users, background: 'rgba(11, 65, 205, 0.08)', color: '#0b41cd' };
  };

  if (screen === 'login') {
    return (
      <div className="auth-app">
        <div className="auth-card">
          <div className="auth-header">
            <span className="brand-badge" aria-label="Wellness passport"><IdCard className="button-icon" /></span>
            <h1>Wellness Passport</h1>
            <p>Sign in to track activity and submit proof.</p>
          </div>

          <div className="participants-count">
            <span>{participants.length}</span> registered participants
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              <span className="input-label"><Mail className="input-icon" /> Roche email</span>
              <input
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                placeholder="name@roche.com"
              />
            </label>

            <label>
              <span className="input-label"><Lock className="input-icon" /> Password</span>
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                placeholder="Enter your password"
              />
            </label>

            {authMessage ? (
              <p className={`auth-message ${authMessage.toLowerCase().includes('success') ? 'success' : 'error'}`}>
                {authMessage}
              </p>
            ) : null}

            <button type="submit" className="primary-button">
              <LogIn className="button-icon" /> Log in
            </button>

            <button type="button" className="link-button" onClick={() => setPasswordRecoveryOpen(true)}>
              Forgot password?
            </button>
          </form>

          {passwordRecoveryOpen ? (
            <div className="password-recovery-modal" role="dialog" aria-modal="true">
              <div className="password-recovery-card">
                <div className="password-recovery-header">
                  <h3>Password recovery</h3>
                  <button type="button" className="close-recovery" onClick={() => setPasswordRecoveryOpen(false)}>×</button>
                </div>
                <label>
                  <span className="input-label"><Mail className="input-icon" /> Roche email</span>
                  <input
                    type="email"
                    value={passwordRecoveryEmail}
                    onChange={(event) => setPasswordRecoveryEmail(event.target.value)}
                    placeholder="name@roche.com"
                  />
                </label>
                <button type="button" className="primary-button" onClick={handleForgotPassword}>
                  Retrieve password
                </button>
              </div>
            </div>
          ) : null}

          <div className="auth-divider">
            <span>or</span>
          </div>

          <button type="button" className="secondary-button" onClick={() => setScreen('register')}>
            <UserPlus className="button-icon" /> Create an account
          </button>

          <div className="auth-divider small-gap">
            <span>admin access</span>
          </div>

          <button type="button" className="secondary-button" onClick={() => setScreen('admin-login')}>
            <ShieldCheck className="button-icon" /> Admin portal
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'register') {
    return (
      <div className="auth-app">
        <div className="auth-card">
          <div className="auth-header">
            <span className="brand-badge" aria-label="Wellness passport"><IdCard className="button-icon" /></span>
            <h1>Create account</h1>
            <p>Register a new participant.</p>
          </div>

          <form className="auth-form" onSubmit={handleRegister}>
            <label>
              <span className="input-label"><Mail className="input-icon" /> Full name</span>
              <input
                type="text"
                value={registerForm.fullName}
                onChange={(event) => setRegisterForm({ ...registerForm, fullName: event.target.value })}
                placeholder="Jane Smith"
              />
            </label>

            <label>
              <span className="input-label"><Mail className="input-icon" /> Roche email</span>
              <input
                type="email"
                value={registerForm.email}
                onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
                placeholder="name@roche.com"
              />
            </label>

            <label>
              <span className="input-label"><Lock className="input-icon" /> Password</span>
              <input
                type="password"
                value={registerForm.password}
                onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                placeholder="Create a password"
              />
            </label>

            <label>
              <span className="input-label"><Lock className="input-icon" /> Confirm password</span>
              <input
                type="password"
                value={registerForm.confirmPassword}
                onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.target.value })}
                placeholder="Re-enter your password"
              />
            </label>

            {registrationMessage ? (
              <p className={`auth-message ${registrationMessage.includes('successful') || registrationMessage.includes('success') ? 'success' : 'error'}`}>
                {registrationMessage}
              </p>
            ) : null}

            <button type="submit" className="primary-button">
              <UserPlus className="button-icon" /> Register participant
            </button>
          </form>

          <button type="button" className="secondary-button" onClick={() => setScreen('login')}>
            <LogIn className="button-icon" /> Back to login
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'admin-login') {
    return (
      <div className="auth-app">
        <div className="auth-card">
          <div className="auth-header">
            <span className="brand-badge admin-badge" aria-label="Admin portal"><ShieldCheck className="button-icon" /></span>
            <h1>Admin portal</h1>
            <p>Access the backend dashboard and participant insights.</p>
          </div>

          <form className="auth-form" onSubmit={handleAdminLogin}>
            <label>
              <span className="input-label"><Mail className="input-icon" /> Admin email</span>
              <input
                type="email"
                value={adminLoginForm.email}
                onChange={(event) => setAdminLoginForm({ ...adminLoginForm, email: event.target.value })}
                placeholder="admin@roche.com"
              />
            </label>

            <label>
              <span className="input-label"><Lock className="input-icon" /> Password</span>
              <input
                type="password"
                value={adminLoginForm.password}
                onChange={(event) => setAdminLoginForm({ ...adminLoginForm, password: event.target.value })}
                placeholder="Admin password"
              />
            </label>

            {adminMessage ? <p className="auth-message error">{adminMessage}</p> : null}

            <button type="submit" className="primary-button">
              <ShieldCheck className="button-icon" /> Log in as admin
            </button>
          </form>

          <button type="button" className="secondary-button" onClick={() => setScreen('admin-register')}>
            <UserPlus className="button-icon" /> Register as admin
          </button>

          <button type="button" className="secondary-button" onClick={() => setScreen('login')}>
            <LogIn className="button-icon" /> Back to participant login
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'admin-register') {
    return (
      <div className="auth-app">
        <div className="auth-card">
          <div className="auth-header">
            <span className="brand-badge admin-badge" aria-label="Admin portal"><ShieldCheck className="button-icon" /></span>
            <h1>Register admin</h1>
            <p>Create an administrator account for the backend dashboard.</p>
          </div>

          <form className="auth-form" onSubmit={handleAdminRegister}>
            <label>
              <span className="input-label"><Mail className="input-icon" /> Full name</span>
              <input
                type="text"
                value={adminRegisterForm.fullName}
                onChange={(event) => setAdminRegisterForm({ ...adminRegisterForm, fullName: event.target.value })}
                placeholder="Roche Admin"
              />
            </label>

            <label>
              <span className="input-label"><Mail className="input-icon" /> Roche email</span>
              <input
                type="email"
                value={adminRegisterForm.email}
                onChange={(event) => setAdminRegisterForm({ ...adminRegisterForm, email: event.target.value })}
                placeholder="admin@roche.com"
              />
            </label>

            <label>
              <span className="input-label"><Lock className="input-icon" /> Password</span>
              <input
                type="password"
                value={adminRegisterForm.password}
                onChange={(event) => setAdminRegisterForm({ ...adminRegisterForm, password: event.target.value })}
                placeholder="Create a secure password"
              />
            </label>

            <label>
              <span className="input-label"><Lock className="input-icon" /> Superadmin password</span>
              <input
                type="password"
                value={adminRegisterForm.superAdminPassword}
                onChange={(event) => setAdminRegisterForm({ ...adminRegisterForm, superAdminPassword: event.target.value })}
                placeholder="Enter the superadmin password"
              />
            </label>

            {adminRegistrationMessage ? (
              <p className={`auth-message ${adminRegistrationMessage.includes('success') || adminRegistrationMessage.includes('created') ? 'success' : 'error'}`}>
                {adminRegistrationMessage}
              </p>
            ) : null}

            <button type="submit" className="primary-button">
              <UserPlus className="button-icon" /> Create admin account
            </button>
          </form>

          <button type="button" className="secondary-button" onClick={() => setScreen('admin-login')}>
            <LogIn className="button-icon" /> Back to admin login
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'qr-print') {
    const printableQrCodes = adminQrCodes.length > 0 ? adminQrCodes : categories.map((category) => ({
      id: category.id,
      title: category.title,
      code: category.scanCode,
      qrCode: ''
    }));

    return (
      <div className="qr-print-app">
        <div className="qr-print-shell">
          <div className="qr-print-header">
            <div>
              <p className="eyebrow">Print QR sheet</p>
              <h1>Wellness Passport QR Codes</h1>
            </div>
            <button type="button" className="secondary-button" onClick={() => setScreen('admin-dashboard')}>
              <LogIn className="button-icon" /> Back to dashboard
            </button>
          </div>

          <div className="qr-print-grid">
            {printableQrCodes.map((item) => (
              <div key={item.id} className="qr-print-card">
                <div className="qr-image-wrap">
                  {item.qrCode ? (
                    <img src={item.qrCode} alt={`${item.title} QR code`} className="qr-image" />
                  ) : (
                    <div className="qr-placeholder">QR unavailable</div>
                  )}
                </div>
                <div className="qr-content">
                  <strong>{item.title}</strong>
                  <small>{item.code}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'admin-dashboard') {
    const stats = adminStats?.stats || {};
    const recentActivity = adminStats?.recentActivity || [];
    const categoryEntries = Object.entries(stats.categoryBreakdown || {});
    const isSuperAdmin = adminUser?.role === 'superadmin';
    const topUsers = [...adminReport]
      .sort((a, b) => Number(b.totalPoints) - Number(a.totalPoints))
      .slice(0, 10);
    const maxCategoryCount = categoryEntries.length > 0 ? Math.max(...categoryEntries.map(([, count]) => Number(count || 0))) : 1;

    const renderAdminLanding = () => (
      <>
        <section className="admin-metrics">
          <article className="metric-card accent">
            <span>Total participants</span>
            <strong>{stats.totalParticipants || 0}</strong>
          </article>
          <article className="metric-card">
            <span>Active participants</span>
            <strong>{stats.activeParticipants || 0}</strong>
          </article>
          <article className="metric-card">
            <span>Total stamps</span>
            <strong>{stats.totalStamps || 0}</strong>
          </article>
          <article className="metric-card">
            <span>Total points</span>
            <strong>{stats.totalPoints || 0}</strong>
          </article>
        </section>

        <section className="admin-grid">
          <div className="admin-panel chart-panel">
            <h3>Category activity</h3>
            {categoryEntries.length === 0 ? (
              <div className="empty-state">No category activity yet.</div>
            ) : (
              <div className="bar-chart">
                {categoryEntries.map(([key, count]) => (
                  <div key={key} className="bar-row">
                    <span>{key}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(Number(count || 0) / maxCategoryCount) * 100}%` }} />
                    </div>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-panel chart-panel">
            <h3>Top 10 users by total points</h3>
            {topUsers.length === 0 ? (
              <div className="empty-state">No point totals yet.</div>
            ) : (
              <div className="bar-chart user-chart">
                {topUsers.map((entry) => (
                  <div key={entry.id} className="bar-row">
                    <span>{entry.fullName}</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill user-fill"
                        style={{ width: `${Math.max((Number(entry.totalPoints || 0) / Math.max(...topUsers.map((u) => Number(u.totalPoints || 0)), 1)) * 100, 8)}%` }}
                      />
                    </div>
                    <strong>{entry.totalPoints}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="admin-activity-stack">
          <div className="admin-panel">
            <h3>Recent activity</h3>
            {recentActivity.length === 0 ? (
              <div className="empty-state">No activity recorded yet.</div>
            ) : (
              <div className="activity-list">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="activity-item">
                    <div>
                      <strong>{activity.participantName}</strong>
                      <small>{activity.participantEmail}</small>
                    </div>
                    <div className="activity-meta">
                      <span>{activity.title}</span>
                      <strong>+{activity.points} pts</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <section className="admin-panel report-panel">
            <div className="section-heading">
              <h3>Participant report</h3>
              <button type="button" className="small-button" onClick={() => {
                window.open('/api/admin/report/csv', '_blank');
              }}>
                Export CSV
              </button>
            </div>

            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Stamps</th>
                    <th>Points</th>
                    <th>Last activity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminReport.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="report-empty">No participant activity yet.</td>
                    </tr>
                  ) : (
                    [...adminReport].sort((a, b) => Number(b.totalPoints) - Number(a.totalPoints)).map((entry) => (
                      <tr key={entry.id}>
                        {editingParticipantId === entry.id ? (
                          <>
                            <td>
                              <input
                                type="text"
                                value={editingParticipantDraft.fullName}
                                onChange={(event) => setEditingParticipantDraft((prev) => ({ ...prev, fullName: event.target.value }))}
                                className="report-inline-input"
                              />
                            </td>
                            <td>
                              <input
                                type="email"
                                value={editingParticipantDraft.email}
                                onChange={(event) => setEditingParticipantDraft((prev) => ({ ...prev, email: event.target.value }))}
                                className="report-inline-input"
                              />
                            </td>
                            <td>
                              <select
                                value={editingParticipantDraft.role}
                                onChange={(event) => setEditingParticipantDraft((prev) => ({ ...prev, role: event.target.value }))}
                                className="report-inline-select"
                              >
                                <option value="participant">Participant</option>
                                <option value="admin">Admin</option>
                              </select>
                            </td>
                            <td>{entry.totalStamps}</td>
                            <td>{entry.totalPoints}</td>
                            <td>{entry.lastActivity}</td>
                            <td>
                              <div className="report-actions-row">
                                <button type="button" className="small-button" onClick={handleSaveParticipant}>Save</button>
                                <button type="button" className="secondary-button small-action" onClick={() => setEditingParticipantId(null)}>Cancel</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{entry.fullName}</td>
                            <td>{entry.email}</td>
                            <td>{entry.role}</td>
                            <td>{entry.totalStamps}</td>
                            <td>{entry.totalPoints}</td>
                            <td>{entry.lastActivity}</td>
                            <td>
                              <div className="report-actions-row">
                                <button type="button" className="icon-button edit-button" onClick={() => handleEditParticipant(entry)} aria-label={`Edit ${entry.fullName}`}>
                                  <Edit className="button-icon" />
                                </button>
                                <button type="button" className="icon-button delete-button" onClick={() => handleDeleteParticipant(entry.id)} aria-label={`Delete ${entry.fullName}`}>
                                  <Trash2 className="button-icon" />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </>
    );

    const renderChallengesSection = () => (
      <section className="admin-panel special-challenges-panel">
        <div className="section-heading">
          <h3>Manage Active challenge</h3>
        </div>

        <div className="challenge-status-card">
          <div className="challenge-status-copy">
            <span className={`challenge-status-pill ${challengeStatus.isActive ? 'live' : 'paused'}`}>
              {challengeStatus.isActive ? 'Active challenge' : 'No active challenge'}
            </span>
            <strong>{challengeStatus.title || 'No active challenge'}</strong>
            {challengeStatus.startedAt ? (
              <small>Started: {new Date(challengeStatus.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</small>
            ) : null}
          </div>

          <div className="admin-challenge-actions">
            <button type="button" className="secondary-button" onClick={handleEndChallenge}>
              End Current Challenge Campaign
            </button>
            <button type="button" className="primary-button" onClick={handleStartChallenge}>
              Create New Challenge Campaign
            </button>
          </div>
        </div>

        <div className="section-heading special-activities-heading">
          <h3>Add Special Activity</h3>
        </div>

        <div className="special-challenges-layout">
          <div className="special-challenges-form">
            <label>
              <span className="input-label">Activity Name</span>
              <input
                type="text"
                value={challengeForm.title}
                onChange={(event) => setChallengeForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="10K Steps Sprint"
              />
            </label>

            <label>
              <span className="input-label">Description</span>
              <textarea
                value={challengeForm.description}
                onChange={(event) => setChallengeForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Describe the challenge and what users need to do."
              />
            </label>

            <div className="special-challenges-row">
              <label>
                <span className="input-label">Points</span>
                <input
                  type="number"
                  min="1"
                  value={challengeForm.points}
                  onChange={(event) => setChallengeForm((prev) => ({ ...prev, points: event.target.value }))}
                />
              </label>
            </div>

            <div className="admin-challenge-actions">
              <button type="button" className="primary-button" onClick={handleSaveSpecialChallenge}>
                {editingChallengeId ? 'Update Special Activity' : 'Add Special Activity'}
              </button>
              {editingChallengeId ? (
                <button type="button" className="secondary-button" onClick={resetChallengeForm}>
                  Cancel
                </button>
              ) : null}
            </div>
          </div>

          <div className="special-challenges-list">
            {specialChallenges.length === 0 ? (
              <div className="empty-state">No special activities configured yet.</div>
            ) : (
              specialChallenges.map((challenge) => (
                <div key={challenge.id} className="admin-community-item">
                  <div>
                    <strong>{challenge.title}</strong>
                    <small>{challenge.points} pts</small>
                  </div>
                  <p>{challenge.description}</p>
                  <small className="challenge-code">{challenge.scanCode}</small>
                  <div className="admin-challenge-actions secondary-row">
                    <button type="button" className="small-button" onClick={() => handleEditChallenge(challenge)}>
                      Edit
                    </button>
                    <button type="button" className="small-button" onClick={() => handleDeleteChallenge(challenge.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    );

    const renderCommunitySection = () => (
      <section className="admin-panel community-admin-panel">
        <div className="section-heading">
          <h3>Community management</h3>
        </div>

        <div className="community-manager-grid">
          <div className="community-manager-form">
            <textarea
              value={adminCommunityDraft.message}
              onChange={(event) => setAdminCommunityDraft((prev) => ({ ...prev, message: event.target.value }))}
              placeholder="Publish an announcement or a community update..."
            />
            <label className="admin-community-toggle">
              <input
                type="checkbox"
                checked={adminCommunityDraft.isAnnouncement}
                onChange={(event) => setAdminCommunityDraft((prev) => ({ ...prev, isAnnouncement: event.target.checked }))}
              />
              Make this an announcement
            </label>
            <button type="button" className="primary-button" onClick={handleAdminCommunityPostSubmit}>
              Publish update
            </button>
          </div>

          <div className="community-manager-list">
            {adminCommunityPosts.length === 0 ? (
              <div className="empty-state">No community posts yet.</div>
            ) : (
              adminCommunityPosts.map((post) => (
                <div key={post.id} className="admin-community-item">
                  <div>
                    <strong>{post.author}</strong>
                    <small>{post.isAnnouncement ? 'Announcement' : 'Community post'}</small>
                  </div>
                  <p>{post.message}</p>
                  <button type="button" className="small-button" onClick={() => handleDeleteCommunityPost(post.id)}>
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    );

    const renderQrSection = () => (
      <section className="admin-panel qr-panel qr-sheet">
        <div className="section-heading qr-header">
          <h3>Category QR codes</h3>
          <button type="button" className="reset-button" onClick={() => {
            setScreen('qr-print');
            setTimeout(() => window.print(), 120);
          }}>
            <ScanLine className="icon" /> Print QR set
          </button>
        </div>

        <div className="qr-grid qr-sheet-grid">
          {adminQrCodes.length === 0 ? (
            <div className="empty-state">Loading category QR codes…</div>
          ) : (
            adminQrCodes.map((item) => (
              <div key={item.id} className="qr-card">
                <div className="qr-image-wrap">
                  <img src={item.qrCode} alt={`${item.title} QR code`} className="qr-image" />
                </div>
                <div className="qr-content">
                  <strong>{item.title}</strong>
                  <small>{item.code}</small>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    );

    return (
      <div className="admin-app">
        <div className="admin-shell">
          <header className="admin-header">
            <div>
              <p className="eyebrow">Admin dashboard</p>
              <h1>Wellness Passport Overview</h1>
            </div>
            <div className="admin-header-actions">
              <button type="button" className="logout-button" onClick={handleAdminLogout}>
                <LogOut className="button-icon" /> Log out
              </button>
            </div>
          </header>

          <nav className="admin-top-nav" aria-label="Admin navigation">
            <button type="button" className={adminTab === 'admin' ? 'active' : ''} onClick={() => setAdminTab('admin')}>Admin</button>
            <button type="button" className={adminTab === 'challenge' ? 'active' : ''} onClick={() => setAdminTab('challenge')}>Manage Active challenge</button>
            <button type="button" className={adminTab === 'community' ? 'active' : ''} onClick={() => setAdminTab('community')}>Community management</button>
            <button type="button" className={adminTab === 'qr' ? 'active' : ''} onClick={() => setAdminTab('qr')}>Category QR codes</button>
          </nav>

          {adminTab === 'admin' && (
            isSuperAdmin ? (
              <section className="admin-panel assignment-panel">
                <h3>Assign admin role</h3>
                <div className="participant-list">
                  {participants.length === 0 ? (
                    <div className="empty-state">No registered participants yet.</div>
                  ) : (
                    participants.map((participant) => {
                      const alreadyAdmin = participant.role === 'admin' || (adminUser?.email && participant.email === adminUser.email);
                      return (
                        <div key={participant.id} className="participant-row">
                          <div>
                            <strong>{participant.fullName}</strong>
                            <small>{participant.email}</small>
                          </div>
                          <button
                            type="button"
                            className="small-button"
                            disabled={alreadyAdmin}
                            onClick={() => promoteParticipantToAdmin(participant)}
                          >
                            {alreadyAdmin ? 'Admin assigned' : 'Assign admin'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

              </section>
            ) : null
          )}

          {adminTab === 'admin' && renderAdminLanding()}
          {adminTab === 'challenge' && renderChallengesSection()}
          {adminTab === 'community' && renderCommunitySection()}
          {adminTab === 'qr' && renderQrSection()}
        </div>
      </div>
    );
  }

  return (
    <div className="wellness-app">
      <div className="passport-shell">
        <div className="portal-layout">
          <nav className="portal-nav" aria-label="Wellness portal navigation">
            <div className="portal-brand" aria-label="Digital passport brand">
              <IdCard className="button-icon" />
            </div>

            <div className="portal-tabs">
              <button
                type="button"
                className={`portal-nav-button ${activePortalTab === 'passport' ? 'active' : ''}`}
                onClick={() => setActivePortalTab('passport')}
              >
                Digital Passport
              </button>
              <button
                type="button"
                className={`portal-nav-button ${activePortalTab === 'community' ? 'active' : ''}`}
                onClick={() => setActivePortalTab('community')}
              >
                Wellness Community
              </button>
              <button
                type="button"
                className={`portal-nav-button ${activePortalTab === 'challenge' ? 'active' : ''}`}
                onClick={() => setActivePortalTab('challenge')}
              >
                Special Activities
              </button>
            </div>
          </nav>

          <div className="portal-content">
            {activePortalTab === 'passport' && (
              <>
                <header className="passport-header">
                  <div className="header-topline">
                    <div>
                      <p className="eyebrow">Wellness Passport</p>
                      <h1>Welcome, {currentUser?.fullName || 'participant'}</h1>
                    </div>
                    <div className="header-actions">
                      <button
                        type="button"
                        className={`profile-button ${activePortalTab === 'account' ? 'active' : ''}`}
                        onClick={() => setActivePortalTab('account')}
                      >
                        Profile
                      </button>
                      <button type="button" className="logout-button" onClick={handleLogout}>
                        <LogOut className="button-icon" /> Log out
                      </button>
                    </div>
                  </div>

                  <div className="points-panel">
                    <div className="points-row">
                      <span>Total Points</span>
                      <strong>
                        {points} pts
                      </strong>
                    </div>
                  </div>

                </header>

                <main className="category-list">
                  {categories.map((category) => {
                    const method = categorySelections[category.id]?.method || 'scan';
                    const hasUpload = Boolean(proofs[category.id]);
                    const scanValue = (scanEntries[category.id] || '').trim().toUpperCase();
                    const isScanReady = scanValue === category.scanCode;
                    const isReady = method === 'scan' ? isScanReady : hasUpload;
                    const canLogActivity = challengeStatus.isActive && isReady;
                    const Icon =
                      category.iconType === 'dumbbell'
                        ? Dumbbell
                        : category.iconType === 'users'
                          ? Users
                          : Trophy;

                    return (
                      <article key={category.id} className="category-card">
                        <div className="card-topline">
                          <div className="category-title-wrap">
                            <div className="icon-badge">
                              <Icon className="category-icon" />
                            </div>
                            <div>
                              <h2>{category.title}</h2>
                              <p>+{category.points} point{category.points > 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <span className={`status-pill ${isReady ? 'success' : 'pending'}`}>
                            {isReady ? <CheckCircle2 className="status-icon" /> : <Camera className="status-icon" />}
                            {isReady ? 'Ready' : 'Proof required'}
                          </span>
                        </div>

                        <div className="method-toggle" aria-label={`Proof method for ${category.title}`}>
                          <button
                            type="button"
                            className={method === 'scan' ? 'active' : ''}
                            onClick={() => setCategorySelections((prev) => ({ ...prev, [category.id]: { method: 'scan' } }))}
                          >
                            <ScanLine className="button-icon" /> Scan code
                          </button>
                          <button
                            type="button"
                            className={method === 'upload' ? 'active' : ''}
                            onClick={() => setCategorySelections((prev) => ({ ...prev, [category.id]: { method: 'upload' } }))}
                          >
                            <Upload className="button-icon" /> Upload proof
                          </button>
                        </div>

                        {method === 'scan' ? (
                          <div className="scan-box">
                            <div className="scan-instruction">Scan the QR code for this activity, then log your check-in.</div>
                            <button type="button" className="scan-camera-button" onClick={() => setScannerCategoryId(category.id)}>
                              <ScanLine className="button-icon" /> Scan code with camera
                            </button>
                            <div className="scan-meta">Point your camera at the QR code for {category.title}.</div>
                          </div>
                        ) : (
                          <label className="upload-box">
                            <span className="upload-label">Photo proof</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(event) => handleProofUpload(category.id, event.target.files?.[0])}
                            />
                            <span className="upload-hint">{category.proofPrompt}</span>
                          </label>
                        )}

                        {method === 'upload' && proofs[category.id] ? (
                          <div className="proof-preview-wrap">
                            <img src={proofs[category.id]} alt={`${category.title} proof`} className="proof-preview" />
                          </div>
                        ) : null}

                        <button
                          type="button"
                          className="log-button"
                          onClick={() => addStamp(category)}
                          disabled={!canLogActivity}
                          title={!challengeStatus.isActive ? 'Campaign not active yet' : ''}
                        >
                          <PlusCircle className="button-icon" /> Log in Activity
                        </button>
                      </article>
                    );
                  })}
                </main>

                <section className="stamp-panel">
                  <div className="section-heading">
                    <h3>Stamp History</h3>
                  </div>

                  {formError ? <p className="auth-message error">{formError}</p> : null}
                  {!challengeStatus.isActive ? (
                    <p className="auth-message error">{noCampaignMessage}</p>
                  ) : null}

                  {!(currentUser?.stamps?.length) ? (
                    <div className="empty-state">
                      No stamps yet. Scan the gym code or upload a photo proof to log your first activity.
                    </div>
                  ) : (
                    <div className="stamp-list">
                      {currentUser.stamps.map((stamp) => {
                        const { Icon, background, color } = getStampBadge(stamp.title);
                        return (
                          <div key={stamp.id} className="stamp-item">
                            <div className="stamp-badge" style={{ background, color }}>
                              <Icon className="stamp-badge-icon" />
                            </div>
                            <div className="stamp-copy">
                              <div className="stamp-title-row">
                                <span className="stamp-title">{stamp.title}</span>
                                <span className="stamp-points">+{stamp.points} pt</span>
                              </div>
                              <span className="stamp-time">
                                {new Date(stamp.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}

            {activePortalTab === 'account' && (
              <section className="community-panel">
                <div className="section-heading">
                  <h3>My account</h3>
                  <button type="button" className="secondary-button small-action" onClick={() => setActivePortalTab('passport')}>
                    Return to dashboard
                  </button>
                </div>

                <div className="profile-card">
                  <div className="profile-avatar-wrap">
                    {accountDraft.profileImage ? (
                      <img src={accountDraft.profileImage} alt="Profile photo" className="profile-avatar" />
                    ) : (
                      <span className="profile-avatar-fallback">{(currentUser?.fullName || 'U').charAt(0).toUpperCase()}</span>
                    )}
                  </div>

                  <label className="upload-button profile-upload-button">
                    <Upload className="button-icon" /> Upload profile pic
                    <input type="file" accept="image/*" onChange={(event) => handleProfileImageUpload(event.target.files?.[0])} />
                  </label>

                  <div className="profile-form-grid">
                    <label>
                      <span className="input-label">Full name</span>
                      <input
                        type="text"
                        value={accountDraft.fullName}
                        onChange={(event) => setAccountDraft((prev) => ({ ...prev, fullName: event.target.value }))}
                      />
                    </label>

                    <label>
                      <span className="input-label">Roche email</span>
                      <input
                        type="email"
                        value={accountDraft.email}
                        onChange={(event) => setAccountDraft((prev) => ({ ...prev, email: event.target.value }))}
                      />
                    </label>

                    <label>
                      <span className="input-label">New password</span>
                      <input
                        type="password"
                        value={accountDraft.password}
                        onChange={(event) => setAccountDraft((prev) => ({ ...prev, password: event.target.value }))}
                        placeholder="Leave blank to keep current password"
                      />
                    </label>
                  </div>

                  {accountMessage ? <p className="auth-message success">{accountMessage}</p> : null}

                  <button type="button" className="primary-button" onClick={handleProfileSave}>
                    <UserPlus className="button-icon" /> Save profile
                  </button>
                </div>
              </section>
            )}

            {activePortalTab === 'community' && (
              <section className="community-panel">
                <div className="section-heading">
                  <h3>Wellness Community</h3>
                  <button type="button" className="secondary-button small-action" onClick={() => setActivePortalTab('passport')}>
                    Return to dashboard
                  </button>
                </div>

                <div className="community-composer">
                  <textarea
                    value={communityDraft.message}
                    onChange={(event) => setCommunityDraft((prev) => ({ ...prev, message: event.target.value }))}
                    placeholder="Share a progress update, encourage peers, or post a workout moment..."
                  />
                  <div className="community-actions">
                    <label className="upload-button">
                      <Upload className="button-icon" /> Add photo
                      <input type="file" accept="image/*" onChange={(event) => handleCommunityImageUpload(event.target.files?.[0])} />
                    </label>
                    <button type="button" className="primary-button small-action" onClick={handleCommunityPostSubmit}>
                      Post update
                    </button>
                  </div>
                  {communityDraft.image ? (
                    <div className="community-preview-wrap">
                      <img src={communityDraft.image} alt="Community upload preview" className="community-preview" />
                    </div>
                  ) : null}
                </div>

                <div className="community-feed">
                  {communityPosts.map((post) => (
                    <article key={post.id} className="community-post">
                      <div className="community-post-header">
                        <div>
                          <strong>{post.author}</strong>
                          <small>{post.role === 'admin' ? 'Admin' : 'Participant'}</small>
                        </div>
                        <span>{post.createdAt}</span>
                      </div>
                      {post.message ? <p>{post.message}</p> : null}
                      {post.image ? <img src={post.image} alt="Community post" className="community-post-image" /> : null}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {activePortalTab === 'challenge' && (
              <section className="challenge-panel">
                <div className="section-heading">
                  <h3>Special Activities</h3>
                  <button type="button" className="secondary-button small-action" onClick={() => setActivePortalTab('passport')}>
                    Return to dashboard
                  </button>
                </div>

                {!challengeStatus.isActive ? (
                  <div className="auth-message error" style={{ marginBottom: '1rem' }}>{noCampaignMessage}</div>
                ) : null}

                {!selectedChallenge ? (
                  <div className="challenge-grid">
                    {specialChallenges.length === 0 ? (
                      <div className="empty-state">No special activities are available yet.</div>
                    ) : (
                      specialChallenges.map((challenge) => (
                        <article key={challenge.id} className="challenge-card challenge-clickable" onClick={() => setSelectedChallenge(challenge)}>
                          <span className="challenge-tag">Special</span>
                          <h3>{challenge.title}</h3>
                          <p>{challenge.description}</p>
                          <strong>Reward: {challenge.points} pts</strong>
                        </article>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="challenge-detail">
                    <div className="section-heading challenge-detail-header">
                      <h3>{selectedChallenge.title}</h3>
                      <button type="button" className="secondary-button small-action" onClick={() => setSelectedChallenge(null)}>
                        Back to activities
                      </button>
                    </div>

                    <div className="challenge-detail-card">
                      <div className="scan-box challenge-scan-box">
                        <div className="scan-instruction">Scan the QR code for this activity, then upload a photo proof to confirm your activity.</div>
                        <button type="button" className="scan-camera-button" onClick={() => setScannerCategoryId(selectedChallenge.id)}>
                          <ScanLine className="button-icon" /> Scan activity QR
                        </button>
                        <div className="scan-meta">Reward: +{selectedChallenge.points} pts</div>
                      </div>

                      <label className="upload-box challenge-upload-box">
                        <span className="upload-label">Photo proof</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(event) => handleProofUpload(selectedChallenge.id, event.target.files?.[0])}
                        />
                        <span className="upload-hint">{selectedChallenge.proofPrompt}</span>
                      </label>

                      {proofs[selectedChallenge.id] ? (
                        <div className="proof-preview-wrap">
                          <img src={proofs[selectedChallenge.id]} alt={`${selectedChallenge.title} proof`} className="proof-preview" />
                        </div>
                      ) : null}

                      <button
                        type="button"
                        className="log-button"
                        onClick={() => addStamp(selectedChallenge)}
                        disabled={!challengeStatus.isActive || !(Boolean(proofs[selectedChallenge.id]) || (scanEntries[selectedChallenge.id] || '').trim().toUpperCase() === selectedChallenge.scanCode)}
                        title={!challengeStatus.isActive ? 'Campaign not active yet' : ''}
                      >
                        <PlusCircle className="button-icon" /> Log in Activity
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

          </div>
        </div>
      </div>

      {scannerCategoryId ? (
        <div className="scanner-modal">
          <div className="scanner-card">
            <div className="scanner-header">
              <h3>Scan gym QR code</h3>
              <button type="button" className="close-scanner" onClick={() => setScannerCategoryId(null)}>
                Close
              </button>
            </div>
            <video ref={videoRef} className="scanner-video" autoPlay playsInline muted />
            <canvas ref={canvasRef} className="scanner-canvas" hidden />
            <p className="scanner-hint">Point your camera at the gym check-in QR code.</p>
            {scannerError ? <p className="auth-message error">{scannerError}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}