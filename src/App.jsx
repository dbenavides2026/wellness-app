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
  Mountain,
  User
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

const hikingCategories = [
  {
    id: 'hiking-club-checkin',
    title: 'Hiking Club Expedition',
    points: 3,
    iconType: 'mountain',
    scanCode: 'HIKING-CLUB-101',
    proofPrompt: 'Upload a photo from your trail or summit check-in.'
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
  const [screen, setScreen] = useState('login');

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = window.localStorage.getItem(CURRENT_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [adminUser, setAdminUser] = useState(() => {
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
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [specialChallenges, setSpecialChallenges] = useState([]);
  const [challengeStatus, setChallengeStatus] = useState({
    isActive: false,
    title: 'No active challenge',
    startedAt: '',
    endedAt: ''
  });

  const [hikingChallenges, setHikingChallenges] = useState([]);
  const [hikingStatus, setHikingStatus] = useState({
    isActive: false,
    title: 'No active hiking season',
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

  const [hikingForm, setHikingForm] = useState({
    title: '',
    description: '',
    points: 15,
    scanCode: '',
    proofPrompt: ''
  });

  const [categorySelections, setCategorySelections] = useState({});
  const [scanEntries, setScanEntries] = useState({});
  const [proofs, setProofs] = useState({});
  const [scannerCategoryId, setScannerCategoryId] = useState(null);
  const [scannerError, setScannerError] = useState('');
  const [formError, setFormError] = useState('');

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ fullName: '', email: '', password: '', profileImage: '' });
  const [profileMsg, setProfileMsg] = useState('');

  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const points = currentUser?.stamps?.reduce((total, stamp) => total + Number(stamp.points || 0), 0) || 0;

  const refreshAllData = async () => {
    try {
      const t = Date.now();
      const [parts, comms, chs, status, hChs, hStatus] = await Promise.all([
        fetchJson(`/api/participants?t=${t}`),
        fetchJson(`/api/admin/community?t=${t}`),
        fetchJson(`/api/challenges?t=${t}`),
        fetchJson(`/api/admin/challenge-status?t=${t}`),
        fetchJson(`/api/hiking-challenges?t=${t}`),
        fetchJson(`/api/admin/hiking-status?t=${t}`)
      ]);

      const updatedParticipants = parts.participants || [];
      setParticipants(updatedParticipants);
      setCommunityPosts(comms.posts || []);
      setAdminCommunityPosts(comms.posts || []);
      setSpecialChallenges(chs.challenges || []);
      setChallengeStatus(status.status || { isActive: false, title: 'No active challenge' });
      setHikingChallenges(hChs.challenges || []);
      setHikingStatus(hStatus.status || { isActive: false, title: 'No active hiking season' });

      if (currentUser?.id) {
        const freshUser = updatedParticipants.find((p) => p.id === currentUser.id);
        if (freshUser) {
          setCurrentUser(freshUser);
        }
      }
    } catch (e) {
      console.error('Data refresh error', e);
    }
  };

  const refreshAdminData = async () => {
    try {
      const t = Date.now();
      const [stats, qrs, rep] = await Promise.all([
        fetchJson(`/api/admin/stats?t=${t}`),
        fetchJson(`/api/admin/qr-codes?t=${t}`),
        fetchJson(`/api/admin/report?t=${t}`)
      ]);
      setAdminStats(stats || { stats: {}, recentActivity: [] });
      setAdminQrCodes(qrs.qrCodes || []);
      setAdminReport(rep.report || []);
    } catch (e) {
      console.error('Admin data error', e);
    }
  };

  useEffect(() => {
    refreshAllData();
    const interval = setInterval(() => {
      refreshAllData();
      if (adminUser) refreshAdminData();
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAllData();
        if (adminUser) refreshAdminData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [currentUser?.id, adminUser?.id]);

  useEffect(() => {
    if (adminUser) refreshAdminData();
  }, [adminUser]);

  useEffect(() => {
    if (currentUser) {
      window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
      setProfileDraft({
        fullName: currentUser.fullName || '',
        email: currentUser.email || '',
        password: '',
        profileImage: currentUser.profileImage || ''
      });
    } else {
      window.localStorage.removeItem(CURRENT_USER_KEY);
    }
  }, [currentUser]);

  useEffect(() => {
    if (adminUser) {
      window.localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(adminUser));
    } else {
      window.localStorage.removeItem(ADMIN_USER_KEY);
    }
  }, [adminUser]);

  useEffect(() => {
    if (currentUser && (screen === 'login' || screen === 'register')) {
      setScreen('dashboard');
    }
    if (adminUser && (screen === 'login' || screen === 'register' || screen === 'admin-login')) {
      setScreen('admin-dashboard');
    }
  }, [currentUser, adminUser, screen]);

  // STRICT QR MATCHING SUBMISSION
  const addStampWithCode = async (activity, directCode = '') => {
    if (!currentUser) return;
    const codeToSend = (directCode || scanEntries[activity.id] || '').trim().toUpperCase();
    const expectedCode = (activity.scanCode || '').trim().toUpperCase();

    if (!codeToSend) {
      setFormError('Please scan or upload a QR code first.');
      return;
    }

    if (expectedCode && codeToSend !== expectedCode) {
      setFormError(`Invalid QR code! Scanned code does not match "${activity.title}".`);
      return;
    }

    try {
      const res = await fetchJson(`/api/participants/${currentUser.id}/stamps`, {
        method: 'POST',
        body: JSON.stringify({
          title: activity.title,
          points: activity.points,
          categoryId: activity.id || 'general',
          scanCode: codeToSend
        })
      });

      if (res.user) {
        setCurrentUser(res.user);
        setFormError('');
        setProofs((p) => { const n = { ...p }; delete n[activity.id]; return n; });
        setScanEntries((p) => { const n = { ...p }; delete n[activity.id]; return n; });
        confetti({ particleCount: 55, spread: 60, origin: { y: 0.8 } });
        await refreshAllData();
      }
    } catch (err) {
      setFormError(err.message || 'Unable to save activity.');
    }
  };

  const addStamp = (activity) => {
    addStampWithCode(activity, scanEntries[activity.id]);
  };

  // CAMERA SCANNER WITH STRICT QR VALIDATION
  useEffect(() => {
    if (!scannerCategoryId) return undefined;
    let animId = 0, cancelled = false;

    const stopStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const scanFrame = () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (v && c && v.readyState >= 2) {
        const ctx = c.getContext('2d');
        c.width = v.videoWidth || 640;
        c.height = v.videoHeight || 480;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const decoded = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
        if (decoded) {
          const val = decoded.data.trim().toUpperCase();

          const targetCategory = categories.find((cat) => cat.id === scannerCategoryId)
            || hikingCategories.find((hc) => hc.id === scannerCategoryId)
            || specialChallenges.find((sc) => sc.id === scannerCategoryId)
            || hikingChallenges.find((hc) => hc.id === scannerCategoryId);

          const expected = (targetCategory?.scanCode || '').trim().toUpperCase();

          if (expected && val !== expected) {
            setScannerError(`Invalid QR! Code does not match "${targetCategory?.title}".`);
            return;
          }

          setScanEntries((prev) => ({ ...prev, [scannerCategoryId]: val }));
          setCategorySelections((prev) => ({ ...prev, [scannerCategoryId]: { method: 'scan' } }));
          stopStream();
          setScannerCategoryId(null);
          setScannerError('');

          addStampWithCode(targetCategory, val);
          return;
        }
      }
      if (!cancelled) animId = window.requestAnimationFrame(scanFrame);
    };

    const startScanner = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        scanFrame();
      } catch (err) {
        if (!cancelled) {
          setScannerError(err.message || 'Unable to access camera.');
          setScannerCategoryId(null);
        }
      }
    };

    startScanner();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animId);
      stopStream();
    };
  }, [scannerCategoryId, activePortalTab, specialChallenges, hikingChallenges]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchJson('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginForm.email.trim().toLowerCase(), password: loginForm.password })
      });
      setCurrentUser(res.user);
      setAuthMessage('');
      setScreen('dashboard');
      refreshAllData();
    } catch (err) {
      setAuthMessage(err.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      setRegistrationMessage('Passwords do not match.');
      return;
    }
    try {
      await fetchJson('/api/register', {
        method: 'POST',
        body: JSON.stringify({ fullName: registerForm.fullName.trim(), email: registerForm.email.trim().toLowerCase(), password: registerForm.password })
      });
      setScreen('login');
      setAuthMessage('Registration successful. Please log in.');
    } catch (err) {
      setRegistrationMessage(err.message);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotMsg('');
    try {
      const res = await fetchJson('/api/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail })
      });
      setForgotMsg(`Success: ${res.message} (${res.password})`);
    } catch (err) {
      setForgotMsg(err.message || 'Unable to retrieve password.');
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    try {
      const res = await fetchJson(`/api/participants/${currentUser.id}/profile`, {
        method: 'PUT',
        body: JSON.stringify(profileDraft)
      });
      setCurrentUser(res.user);
      setProfileMsg('Profile updated successfully!');
      await refreshAllData();
    } catch (err) {
      setProfileMsg(err.message || 'Unable to update profile.');
    }
  };

  const handleProfileImageUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileDraft((prev) => ({ ...prev, profileImage: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchJson('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: adminLoginForm.email.trim().toLowerCase(), password: adminLoginForm.password })
      });
      setAdminUser(res.user);
      setAdminMessage('');
      setScreen('admin-dashboard');
    } catch (err) {
      setAdminMessage(err.message);
    }
  };

  const promoteParticipantToAdmin = async (participant) => {
    try {
      const response = await fetchJson(`/api/admin/participants/${participant.id}/promote`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      setAdminMessage(response.message || `${participant.fullName} promoted to admin.`);
      await refreshAllData();
      await refreshAdminData();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to promote user.');
    }
  };

  const handleEditUser = (user) => {
    setEditingParticipantId(user.id);
    setEditingParticipantDraft({ fullName: user.fullName, email: user.email, role: user.role || 'participant' });
  };

  const handleSaveUser = async () => {
    try {
      await fetchJson(`/api/admin/participants/${editingParticipantId}`, {
        method: 'PUT',
        body: JSON.stringify(editingParticipantDraft)
      });
      setEditingParticipantId(null);
      setAdminMessage('User updated successfully.');
      await refreshAllData();
      await refreshAdminData();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to update user.');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await fetchJson(`/api/admin/participants/${userId}`, { method: 'DELETE' });
      setAdminMessage('User deleted successfully.');
      await refreshAllData();
      await refreshAdminData();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to delete user.');
    }
  };

  const handleDeleteSpecialActivity = async (id) => {
    if (!window.confirm('Delete this special activity?')) return;
    try {
      await fetchJson(`/api/admin/challenges/${id}`, { method: 'DELETE' });
      setAdminMessage('Special activity deleted successfully.');
      await refreshAllData();
      await refreshAdminData();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to delete activity.');
    }
  };

  const handleDeleteHikingActivity = async (id) => {
    if (!window.confirm('Delete this hiking activity?')) return;
    try {
      await fetchJson(`/api/admin/hiking-challenges/${id}`, { method: 'DELETE' });
      setAdminMessage('Hiking activity deleted successfully.');
      await refreshAllData();
      await refreshAdminData();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to delete hiking activity.');
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
    setProfileOpen(false);
  };

  const handleAdminLogout = () => {
    setAdminUser(null);
    setScreen('login');
    setAdminMessage('');
  };

  const handleCommunityImageUpload = (file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setCommunityDraft((prev) => ({ ...prev, image: previewUrl }));
  };

  const handleCommunityPostSubmit = () => {
    const message = communityDraft.message.trim();
    if (!message && !communityDraft.image) return;

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

    setCommunityDraft({ message: '', image: '' });
  };

  const handleAdminCommunityPostSubmit = async () => {
    const message = adminCommunityDraft.message.trim();
    if (!message) {
      setAdminMessage('Add a message to publish an announcement.');
      return;
    }

    try {
      await fetchJson('/api/admin/community', {
        method: 'POST',
        body: JSON.stringify({
          author: 'Wellness Team',
          role: adminUser?.role || 'admin',
          message,
          image: adminCommunityDraft.image,
          isAnnouncement: adminCommunityDraft.isAnnouncement
        })
      });

      setAdminCommunityDraft({ message: '', image: '', isAnnouncement: true });
      setAdminMessage('Community update published successfully.');
      await refreshAllData();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to save community update.');
    }
  };

  const handleSaveSpecialChallenge = async () => {
    const title = challengeForm.title.trim();
    const description = challengeForm.description.trim();
    if (!title || !description) {
      setAdminMessage('Activity name and description are required.');
      return;
    }

    try {
      await fetchJson('/api/admin/challenges', {
        method: 'POST',
        body: JSON.stringify({
          ...challengeForm,
          points: Number(challengeForm.points) || 10,
          proofPrompt: challengeForm.proofPrompt.trim() || 'Upload a photo proof.'
        })
      });

      setChallengeForm({ title: '', description: '', points: 10, scanCode: '', proofPrompt: '' });
      setAdminMessage('Wellness Special activity saved successfully.');
      await refreshAllData();
      await refreshAdminData();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to save activity.');
    }
  };

  const handleSaveHikingChallenge = async () => {
    const title = hikingForm.title.trim();
    const description = hikingForm.description.trim();
    if (!title || !description) {
      setAdminMessage('Hiking title and description are required.');
      return;
    }

    try {
      await fetchJson('/api/admin/hiking-challenges', {
        method: 'POST',
        body: JSON.stringify({
          ...hikingForm,
          points: Number(hikingForm.points) || 15,
          proofPrompt: hikingForm.proofPrompt.trim() || 'Upload a photo proof.'
        })
      });

      setHikingForm({ title: '', description: '', points: 15, scanCode: '', proofPrompt: '' });
      setAdminMessage('Hiking activity saved successfully.');
      await refreshAllData();
      await refreshAdminData();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to save hiking activity.');
    }
  };

  const handleStartChallenge = async () => {
    try {
      const response = await fetchJson('/api/admin/challenge-status/start', {
        method: 'POST',
        body: JSON.stringify({ title: 'Active Wellness Challenge Campaign' })
      });
      setChallengeStatus(response.status || challengeStatus);
      setAdminMessage('New Wellness Challenge campaign started.');
      await refreshAllData();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to start campaign.');
    }
  };

  const handleEndChallenge = async () => {
    try {
      const response = await fetchJson('/api/admin/challenge-status/end', { method: 'POST' });
      setChallengeStatus(response.status || challengeStatus);
      setAdminMessage('Wellness Challenge campaign closed. Users retained, activity logs cleared.');
      await refreshAllData();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to end campaign.');
    }
  };

  const handleStartHikingSeason = async () => {
    try {
      const response = await fetchJson('/api/admin/hiking-status/start', {
        method: 'POST',
        body: JSON.stringify({ title: 'Active Hiking Season Campaign' })
      });
      setHikingStatus(response.status || hikingStatus);
      setAdminMessage('New Hiking Season started.');
      await refreshAllData();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to start hiking season.');
    }
  };

  const handleEndHikingSeason = async () => {
    try {
      const response = await fetchJson('/api/admin/hiking-status/end', { method: 'POST' });
      setHikingStatus(response.status || hikingStatus);
      setAdminMessage('Hiking Season closed.');
      await refreshAllData();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to end hiking season.');
    }
  };

  const getStampBadge = (title) => {
    const normalized = String(title || '').toLowerCase();
    if (normalized.includes('hiking') || normalized.includes('summit') || normalized.includes('hike') || normalized.includes('trail')) {
      return { Icon: Mountain, background: 'rgba(21, 128, 61, 0.12)', color: '#15803d' };
    }
    if (normalized.includes('challenge') || normalized.includes('sprint') || normalized.includes('boost') || normalized.includes('outdoor') || normalized.includes('move')) {
      return { Icon: Sparkles, background: 'rgba(245, 158, 11, 0.12)', color: '#b45309' };
    }
    if (normalized.includes('gym') || normalized.includes('workout')) {
      return { Icon: Dumbbell, background: 'rgba(11, 65, 205, 0.12)', color: '#0b41cd' };
    }
    return { Icon: Users, background: 'rgba(11, 65, 205, 0.08)', color: '#0b41cd' };
  };

  if (screen === 'login') {
    return (
      <div className="auth-app">
        <div className="auth-card">
          <div className="auth-header">
            <span className="brand-badge"><IdCard className="button-icon" /></span>
            <h1>Wellness Passport</h1>
            <p>Sign in to track activity and submit proof.</p>
          </div>
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              <span className="input-label"><Mail className="input-icon" /> Email</span>
              <input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} required />
            </label>
            <label>
              <span className="input-label"><Lock className="input-icon" /> Password</span>
              <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required />
            </label>
            {authMessage && <p className="auth-message error">{authMessage}</p>}
            <button type="submit" className="primary-button"><LogIn className="button-icon" /> Log in</button>
            <button type="button" className="secondary-button" style={{ marginTop: '0.5rem', background: 'transparent', border: 'none', color: '#0b41cd', cursor: 'pointer' }} onClick={() => setForgotPasswordOpen(true)}>
              Forgot password?
            </button>
          </form>
          <div className="auth-divider"><span>or</span></div>
          <button type="button" className="secondary-button" onClick={() => setScreen('register')}><UserPlus className="button-icon" /> Create an account</button>
          <div className="auth-divider small-gap"><span>admin access</span></div>
          <button type="button" className="secondary-button" onClick={() => setScreen('admin-login')}><ShieldCheck className="button-icon" /> Admin portal</button>
        </div>

        {/* FORGOT PASSWORD MODAL */}
        {forgotPasswordOpen && (
          <div className="scanner-modal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="scanner-card" style={{ padding: '1.5rem', maxWidth: '400px', width: '100%', background: '#fff', borderRadius: '12px' }}>
              <h3>Forgot Password</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Enter your email to retrieve your password from the database.</p>
              <form onSubmit={handleForgotPassword} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input type="email" placeholder="registered@email.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                {forgotMsg && <p className="auth-message" style={{ fontSize: '0.85rem' }}>{forgotMsg}</p>}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button type="submit" className="primary-button">Retrieve Password</button>
                  <button type="button" className="secondary-button" onClick={() => { setForgotPasswordOpen(false); setForgotMsg(''); }}>Close</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (screen === 'register') {
    return (
      <div className="auth-app">
        <div className="auth-card">
          <div className="auth-header">
            <span className="brand-badge"><IdCard className="button-icon" /></span>
            <h1>Create account</h1>
          </div>
          <form className="auth-form" onSubmit={handleRegister}>
            <label><span className="input-label">Full name</span><input type="text" value={registerForm.fullName} onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })} required /></label>
            <label><span className="input-label">Email</span><input type="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} required /></label>
            <label><span className="input-label">Password</span><input type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} required /></label>
            <label><span className="input-label">Confirm password</span><input type="password" value={registerForm.confirmPassword} onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })} required /></label>
            {registrationMessage && <p className="auth-message error">{registrationMessage}</p>}
            <button type="submit" className="primary-button"><UserPlus className="button-icon" /> Register participant</button>
          </form>
          <button type="button" className="secondary-button" onClick={() => setScreen('login')}>Back to login</button>
        </div>
      </div>
    );
  }

  if (screen === 'admin-login') {
    return (
      <div className="auth-app">
        <div className="auth-card">
          <div className="auth-header">
            <span className="brand-badge admin-badge"><ShieldCheck className="button-icon" /></span>
            <h1>Admin portal</h1>
          </div>
          <form className="auth-form" onSubmit={handleAdminLogin}>
            <label><span className="input-label">Admin email</span><input type="email" value={adminLoginForm.email} onChange={(e) => setAdminLoginForm({ ...adminLoginForm, email: e.target.value })} required /></label>
            <label><span className="input-label">Password</span><input type="password" value={adminLoginForm.password} onChange={(e) => setAdminLoginForm({ ...adminLoginForm, password: e.target.value })} required /></label>
            {adminMessage && <p className="auth-message error">{adminMessage}</p>}
            <button type="submit" className="primary-button"><ShieldCheck className="button-icon" /> Log in as admin</button>
          </form>
          <button type="button" className="secondary-button" onClick={() => setScreen('login')}>Back to login</button>
        </div>
      </div>
    );
  }

  if (screen === 'admin-dashboard') {
    const stats = adminStats?.stats || {};
    const categoryEntries = Object.entries(stats.categoryBreakdown || {});
    const topUsers = [...adminReport].sort((a, b) => Number(b.totalPoints) - Number(a.totalPoints)).slice(0, 10);
    const maxCategoryCount = categoryEntries.length > 0 ? Math.max(...categoryEntries.map(([, count]) => Number(count || 0))) : 1;
    const maxUserPoints = topUsers.length > 0 ? Math.max(...topUsers.map((u) => Number(u.totalPoints || 0))) : 1;

    return (
      <div className="admin-app">
        <div className="admin-shell">
          <header className="admin-header">
            <div>
              <p className="eyebrow">Admin dashboard</p>
              <h1>Wellness Passport Overview</h1>
            </div>
            <button type="button" className="logout-button" onClick={handleAdminLogout}><LogOut className="button-icon" /> Log out</button>
          </header>

          <nav className="admin-top-nav" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button type="button" className={adminTab === 'admin' ? 'active' : ''} onClick={() => setAdminTab('admin')}>Overview</button>
            <button type="button" className={adminTab === 'users' ? 'active' : ''} onClick={() => setAdminTab('users')}>User management</button>
            <button type="button" className={adminTab === 'challenge' ? 'active' : ''} onClick={() => setAdminTab('challenge')}>Manage Wellness Challenge</button>
            <button type="button" className={adminTab === 'hiking' ? 'active' : ''} onClick={() => setAdminTab('hiking')}>Manage Hiking Club</button>
            <button type="button" className={adminTab === 'community' ? 'active' : ''} onClick={() => setAdminTab('community')}>Community management</button>
            <button type="button" className={adminTab === 'qr' ? 'active' : ''} onClick={() => setAdminTab('qr')}>Category QR codes</button>
          </nav>

          {adminMessage ? <p className="auth-message success" style={{ margin: '1rem 0' }}>{adminMessage}</p> : null}

          {/* OVERVIEW PRINCIPAL */}
          {adminTab === 'admin' && (
            <>
              <section className="admin-metrics">
                <article className="metric-card accent"><span>Total participants</span><strong>{stats.totalParticipants || 0}</strong></article>
                <article className="metric-card"><span>Active participants</span><strong>{stats.activeParticipants || 0}</strong></article>
                <article className="metric-card"><span>Total stamps</span><strong>{stats.totalStamps || 0}</strong></article>
                <article className="metric-card"><span>Total points</span><strong>{stats.totalPoints || 0}</strong></article>
              </section>

              <section className="admin-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', margin: '1.5rem 0' }}>
                <div className="admin-panel chart-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
                  <h3>Category activity</h3>
                  {categoryEntries.length === 0 ? (
                    <div className="empty-state">No category activity yet.</div>
                  ) : (
                    <div className="bar-chart" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                      {categoryEntries.map(([key, count]) => (
                        <div key={key} className="bar-row">
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>{key}</span>
                          <div className="bar-track" style={{ background: '#f1f5f9', borderRadius: '4px', height: '10px', overflow: 'hidden', margin: '4px 0' }}>
                            <div className="bar-fill" style={{ width: `${(Number(count || 0) / maxCategoryCount) * 100}%`, background: '#0b41cd', height: '100%' }} />
                          </div>
                          <strong style={{ color: '#0f172a' }}>{count}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="admin-panel chart-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
                  <h3>Top 10 users by total points</h3>
                  {topUsers.length === 0 ? (
                    <div className="empty-state">No point totals yet.</div>
                  ) : (
                    <div className="bar-chart user-chart" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                      {topUsers.map((entry) => (
                        <div key={entry.id} className="bar-row">
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>{entry.fullName}</span>
                          <div className="bar-track" style={{ background: '#f1f5f9', borderRadius: '4px', height: '10px', overflow: 'hidden', margin: '4px 0' }}>
                            <div className="bar-fill user-fill" style={{ width: `${Math.max((Number(entry.totalPoints || 0) / maxUserPoints) * 100, 8)}%`, background: '#f59e0b', height: '100%' }} />
                          </div>
                          <strong style={{ color: '#0f172a' }}>{entry.totalPoints} pts</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* REPORT CON BOTONES DE ACCIÓN */}
              <section className="admin-panel report-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
                <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ color: '#0f172a' }}>Wellness Challenge participants</h3>
                  <button type="button" className="small-button" onClick={() => window.open('/api/admin/report/csv', '_blank')}>Export CSV</button>
                </div>
                <div className="report-table-wrap" style={{ overflowX: 'auto', marginTop: '1rem' }}>
                  <table className="report-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', color: '#0f172a' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}><th>Name</th><th>Email</th><th>Role</th><th>Stamps</th><th>Points</th><th>Last activity</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {adminReport.length === 0 ? (
                        <tr><td colSpan="7" style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No participant activity yet.</td></tr>
                      ) : (
                        adminReport.map((entry) => (
                          <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            {editingParticipantId === entry.id ? (
                              <>
                                <td><input type="text" value={editingParticipantDraft.fullName} onChange={(e) => setEditingParticipantDraft({ ...editingParticipantDraft, fullName: e.target.value })} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} /></td>
                                <td><input type="email" value={editingParticipantDraft.email} onChange={(e) => setEditingParticipantDraft({ ...editingParticipantDraft, email: e.target.value })} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} /></td>
                                <td>
                                  <select value={editingParticipantDraft.role} onChange={(e) => setEditingParticipantDraft({ ...editingParticipantDraft, role: e.target.value })} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                    <option value="participant">Participant</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                </td>
                                <td>{entry.totalStamps}</td>
                                <td>{entry.totalPoints}</td>
                                <td>{entry.lastActivity}</td>
                                <td>
                                  <button type="button" className="small-button" onClick={handleSaveUser}>Save</button>
                                  <button type="button" className="secondary-button small-action" onClick={() => setEditingParticipantId(null)}>Cancel</button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td style={{ padding: '0.75rem 0', fontWeight: 600 }}>{entry.fullName}</td>
                                <td>{entry.email}</td>
                                <td><span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: entry.role === 'admin' ? '#e0e7ff' : '#f1f5f9', color: entry.role === 'admin' ? '#3730a3' : '#475569', fontSize: '0.8rem', fontWeight: 600 }}>{entry.role}</span></td>
                                <td>{entry.totalStamps}</td>
                                <td><strong>{entry.totalPoints}</strong></td>
                                <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{entry.lastActivity}</td>
                                <td style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button type="button" className="icon-button edit-button" onClick={() => handleEditUser(entry)} aria-label="Edit User"><Edit size={16} /></button>
                                  <button type="button" className="icon-button delete-button" onClick={() => handleDeleteUser(entry.id)} aria-label="Delete User"><Trash2 size={16} /></button>
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
            </>
          )}

          {/* SECCIÓN USER MANAGEMENT - WHITE BACKGROUND & HIGH CONTRAST */}
          {adminTab === 'users' && (
            <section className="admin-panel assignment-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
              <div className="section-heading">
                <h3 style={{ color: '#0f172a' }}>Registered Account Management</h3>
              </div>
              <div className="participant-list" style={{ marginTop: '1rem', background: '#ffffff' }}>
                {participants.length === 0 ? (
                  <div className="empty-state">No registered accounts found.</div>
                ) : (
                  participants.map((p) => (
                    <div key={p.id} className="participant-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 0', borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
                      <div>
                        <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{p.fullName}</strong> <small style={{ color: '#64748b' }}>({p.role || 'participant'})</small>
                        <br />
                        <span style={{ color: '#475569', fontSize: '0.85rem' }}>{p.email}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {p.role !== 'admin' && (
                          <button type="button" className="small-button" onClick={() => promoteParticipantToAdmin(p)}>Assign admin</button>
                        )}
                        <button type="button" className="icon-button edit-button" onClick={() => handleEditUser(p)}><Edit size={16} /></button>
                        <button type="button" className="icon-button delete-button" onClick={() => handleDeleteUser(p.id)}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* SECCIÓN MANAGE WELLNESS CHALLENGE */}
          {adminTab === 'challenge' && (
            <section className="admin-panel special-challenges-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
              <div className="section-heading"><h3 style={{ color: '#0f172a' }}>Manage Wellness Challenge</h3></div>
              <div className="challenge-status-card">
                <div className="challenge-status-copy">
                  <span className={`challenge-status-pill ${challengeStatus.isActive ? 'live' : 'paused'}`}>{challengeStatus.isActive ? 'Active Campaign' : 'Campaign Ended'}</span>
                  <strong style={{ color: '#0f172a' }}>{challengeStatus.title || 'No active campaign'}</strong>
                </div>
                <div className="admin-challenge-actions">
                  <button type="button" className="secondary-button" onClick={handleEndChallenge}>End Current Challenge Campaign</button>
                  <button type="button" className="primary-button" onClick={handleStartChallenge}>Create New Challenge Campaign</button>
                </div>
              </div>

              <div className="section-heading special-activities-heading" style={{ marginTop: '1.5rem' }}><h3 style={{ color: '#0f172a' }}>Add Special Activity</h3></div>
              <div className="special-challenges-layout">
                <div className="special-challenges-form">
                  <label><span className="input-label">Activity Name</span><input type="text" value={challengeForm.title} onChange={(e) => setChallengeForm({ ...challengeForm, title: e.target.value })} placeholder="10K Steps Sprint" /></label>
                  <label><span className="input-label">Description</span><textarea value={challengeForm.description} onChange={(e) => setChallengeForm({ ...challengeForm, description: e.target.value })} placeholder="Describe the challenge..." /></label>
                  <label><span className="input-label">Points</span><input type="number" min="1" value={challengeForm.points} onChange={(e) => setChallengeForm({ ...challengeForm, points: e.target.value })} /></label>
                  <button type="button" className="primary-button" onClick={handleSaveSpecialChallenge}>Add Special Activity</button>
                </div>
                <div className="special-challenges-list">
                  {specialChallenges.length === 0 ? <div className="empty-state">No special activities configured yet.</div> : (
                    specialChallenges.map((ch) => (
                      <div key={ch.id} className="admin-community-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', marginBottom: '0.5rem' }}>
                        <div>
                          <strong style={{ color: '#0f172a' }}>{ch.title}</strong> <small style={{ color: '#0b41cd' }}>{ch.points} pts</small>
                          <p style={{ margin: '0.25rem 0 0 0', color: '#475569', fontSize: '0.85rem' }}>{ch.description}</p>
                          <small className="challenge-code">{ch.scanCode}</small>
                        </div>
                        <button type="button" className="icon-button delete-button" onClick={() => handleDeleteSpecialActivity(ch.id)}><Trash2 size={16} /></button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {/* SECCIÓN MANAGE HIKING CLUB */}
          {adminTab === 'hiking' && (
            <section className="admin-panel special-challenges-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
              <div className="section-heading"><h3 style={{ color: '#0f172a' }}>Manage Hiking Club</h3></div>
              <div className="challenge-status-card">
                <div className="challenge-status-copy">
                  <span className={`challenge-status-pill ${hikingStatus.isActive ? 'live' : 'paused'}`}>{hikingStatus.isActive ? 'Active Hiking Season' : 'Hiking Season Closed'}</span>
                  <strong style={{ color: '#0f172a' }}>{hikingStatus.title || 'No active hiking season'}</strong>
                </div>
                <div className="admin-challenge-actions">
                  <button type="button" className="secondary-button" onClick={handleEndHikingSeason}>End Hiking Campaign</button>
                  <button type="button" className="primary-button" onClick={handleStartHikingSeason}>Start New Hiking Campaign</button>
                </div>
              </div>

              <div className="section-heading special-activities-heading" style={{ marginTop: '1.5rem' }}><h3 style={{ color: '#0f172a' }}>Add Hiking Activity</h3></div>
              <div className="special-challenges-layout">
                <div className="special-challenges-form">
                  <label><span className="input-label">Hike Title</span><input type="text" value={hikingForm.title} onChange={(e) => setHikingForm({ ...hikingForm, title: e.target.value })} placeholder="Summit Peak Hike" /></label>
                  <label><span className="input-label">Description</span><textarea value={hikingForm.description} onChange={(e) => setHikingForm({ ...hikingForm, description: e.target.value })} placeholder="Describe location and difficulty..." /></label>
                  <label><span className="input-label">Points</span><input type="number" min="1" value={hikingForm.points} onChange={(e) => setHikingForm({ ...hikingForm, points: e.target.value })} /></label>
                  <button type="button" className="primary-button" onClick={handleSaveHikingChallenge}>Add Hiking Activity</button>
                </div>
                <div className="special-challenges-list">
                  {hikingChallenges.length === 0 ? <div className="empty-state">No hiking activities configured yet.</div> : (
                    hikingChallenges.map((ch) => (
                      <div key={ch.id} className="admin-community-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', marginBottom: '0.5rem' }}>
                        <div>
                          <strong style={{ color: '#0f172a' }}>{ch.title}</strong> <small style={{ color: '#15803d' }}>{ch.points} pts</small>
                          <p style={{ margin: '0.25rem 0 0 0', color: '#475569', fontSize: '0.85rem' }}>{ch.description}</p>
                          <small className="challenge-code">{ch.scanCode}</small>
                        </div>
                        <button type="button" className="icon-button delete-button" onClick={() => handleDeleteHikingActivity(ch.id)}><Trash2 size={16} /></button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {/* COMMUNITY MANAGEMENT */}
          {adminTab === 'community' && (
            <section className="admin-panel community-admin-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
              <div className="section-heading"><h3 style={{ color: '#0f172a' }}>Community management</h3></div>
              <div className="community-manager-grid">
                <div className="community-manager-form">
                  <textarea value={adminCommunityDraft.message} onChange={(e) => setAdminCommunityDraft({ ...adminCommunityDraft, message: e.target.value })} placeholder="Publish an announcement..." />
                  <button type="button" className="primary-button" onClick={handleAdminCommunityPostSubmit}>Publish update</button>
                </div>
                <div className="community-manager-list">
                  {adminCommunityPosts.length === 0 ? <div className="empty-state">No community posts yet.</div> : (
                    adminCommunityPosts.map((post) => (
                      <div key={post.id} className="admin-community-item">
                        <div><strong style={{ color: '#0f172a' }}>{post.author}</strong> <small>{post.isAnnouncement ? 'Announcement' : 'Community post'}</small></div>
                        <p style={{ color: '#475569' }}>{post.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {/* CATEGORY QR CODES */}
          {adminTab === 'qr' && (
            <section className="admin-panel qr-panel qr-sheet" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
              <div className="section-heading qr-header"><h3 style={{ color: '#0f172a' }}>Category QR codes</h3></div>
              <div className="qr-grid qr-sheet-grid">
                {adminQrCodes.length === 0 ? <div className="empty-state">Loading QR codes…</div> : (
                  adminQrCodes.map((item) => (
                    <div key={item.id} className="qr-card">
                      <img src={item.qrCode} alt={item.title} className="qr-image" />
                      <strong style={{ color: '#0f172a' }}>{item.title}</strong>
                      <small>{item.code}</small>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="wellness-app">
      <div className="passport-shell">
        <div className="portal-layout">
          <nav className="portal-nav">
            <div className="portal-brand"><IdCard className="button-icon" /></div>
            <div className="portal-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', width: '100%' }}>
              <button type="button" className={`portal-nav-button ${activePortalTab === 'passport' ? 'active' : ''}`} onClick={() => setActivePortalTab('passport')}>Digital Passport</button>
              <button type="button" className={`portal-nav-button ${activePortalTab === 'community' ? 'active' : ''}`} onClick={() => setActivePortalTab('community')}>Wellness Community</button>
              <button type="button" className={`portal-nav-button ${activePortalTab === 'challenge' ? 'active' : ''}`} onClick={() => setActivePortalTab('challenge')}>Special Activities</button>
              <button type="button" className={`portal-nav-button ${activePortalTab === 'hiking' ? 'active' : ''}`} onClick={() => setActivePortalTab('hiking')}>Hiking Club</button>
            </div>
          </nav>

          <div className="portal-content">
            {formError && (
              <div className="auth-message error" style={{ marginBottom: '1rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.75rem', borderRadius: '8px' }}>
                {formError}
              </div>
            )}

            {/* DIGITAL PASSPORT TAB */}
            {activePortalTab === 'passport' && (
              <>
                <header className="passport-header">
                  <div className="header-topline">
                    <div>
                      <p className="eyebrow">Wellness Passport</p>
                      <h1>Welcome, {currentUser?.fullName || 'participant'}</h1>
                    </div>
                    <div className="header-actions" style
