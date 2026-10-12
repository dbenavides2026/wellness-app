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

  const refreshAllData = async () => {
    try {
      const t = Date.now();
      const [parts, comms, chs, status] = await Promise.all([
        fetchJson(`/api/participants?t=${t}`),
        fetchJson(`/api/admin/community?t=${t}`),
        fetchJson(`/api/challenges?t=${t}`),
        fetchJson(`/api/admin/challenge-status?t=${t}`)
      ]);

      const updatedParticipants = parts.participants || [];
      setParticipants(updatedParticipants);
      setCommunityPosts(comms.posts || []);
      setAdminCommunityPosts(comms.posts || []);
      setSpecialChallenges(chs.challenges || []);
      setChallengeStatus(status.status || { isActive: false, title: 'No active challenge' });

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

  const addStampWithCode = async (activity, directCode = '') => {
    if (!currentUser) return;
    const codeToSend = directCode || scanEntries[activity.id] || activity.scanCode || '';

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
          setScanEntries((prev) => ({ ...prev, [scannerCategoryId]: val }));
          setCategorySelections((prev) => ({ ...prev, [scannerCategoryId]: { method: 'scan' } }));
          stopStream();
          setScannerCategoryId(null);
          setScannerError('');

          const targetCategory = categories.find((cat) => cat.id === scannerCategoryId)
            || specialChallenges.find((sc) => sc.id === scannerCategoryId)
            || { id: scannerCategoryId, title: 'QR Check-in', points: 1 };

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
  }, [scannerCategoryId]);

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
    if (!adminUser || (adminUser.role !== 'superadmin' && adminUser.role !== 'admin')) {
      setAdminMessage('Only admins can assign administrative access.');
      return;
    }

    try {
      const response = await fetchJson(`/api/admin/participants/${participant.id}/promote`, {
        method: 'POST',
        body: JSON.stringify({})
      });

      setAdminMessage(response.message || `${participant.fullName} was promoted to admin.`);
      await refreshAllData();
      await refreshAdminData();
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
      const method = editingChallengeId ? 'PUT' : 'POST';
      const url = editingChallengeId ? `/api/admin/challenges/${editingChallengeId}` : '/api/admin/challenges';
      await fetchJson(url, {
        method,
        body: JSON.stringify({
          ...challengeForm,
          points: Number(challengeForm.points) || 10,
          proofPrompt: challengeForm.proofPrompt.trim() || 'Upload a photo proof.'
        })
      });

      setChallengeForm({ title: '', description: '', points: 10, scanCode: '', proofPrompt: '' });
      setEditingChallengeId(null);
      setAdminMessage('Special activity saved successfully.');
      await refreshAllData();
      await refreshAdminData();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to save activity.');
    }
  };

  const handleStartChallenge = async () => {
    try {
      const response = await fetchJson('/api/admin/challenge-status/start', {
        method: 'POST',
        body: JSON.stringify({ title: 'Fresh challenge campaign started' })
      });
      setChallengeStatus(response.status || challengeStatus);
      setAdminMessage('New challenge campaign started.');
      await refreshAllData();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to start campaign.');
    }
  };

  const handleEndChallenge = async () => {
    try {
      const response = await fetchJson('/api/admin/challenge-status/end', { method: 'POST' });
      setChallengeStatus(response.status || challengeStatus);
      setAdminMessage('Current challenge campaign ended.');
      await refreshAllData();
    } catch (error) {
      setAdminMessage(error.message || 'Unable to end campaign.');
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
          </form>
          <div className="auth-divider"><span>or</span></div>
          <button type="button" className="secondary-button" onClick={() => setScreen('register')}><UserPlus className="button-icon" /> Create an account</button>
          <div className="auth-divider small-gap"><span>admin access</span></div>
          <button type="button" className="secondary-button" onClick={() => setScreen('admin-login')}><ShieldCheck className="button-icon" /> Admin portal</button>
        </div>
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
    const recentActivity = adminStats?.recentActivity || [];
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

          <nav className="admin-top-nav">
            <button type="button" className={adminTab === 'admin' ? 'active' : ''} onClick={() => setAdminTab('admin')}>Admin</button>
            <button type="button" className={adminTab === 'challenge' ? 'active' : ''} onClick={() => setAdminTab('challenge')}>Manage Active challenge</button>
            <button type="button" className={adminTab === 'community' ? 'active' : ''} onClick={() => setAdminTab('community')}>Community management</button>
            <button type="button" className={adminTab === 'qr' ? 'active' : ''} onClick={() => setAdminTab('qr')}>Category QR codes</button>
          </nav>

          {adminMessage ? <p className="auth-message success" style={{ margin: '1rem 0' }}>{adminMessage}</p> : null}

          {/* TAB ADMIN: ASIGNAR ROLES, MÉTRICAS Y GRÁFICOS */}
          {adminTab === 'admin' && (
            <>
              {/* PANEL DE ASIGNACIÓN DE ADMIN */}
              <section className="admin-panel assignment-panel" style={{ marginBottom: '1.5rem' }}>
                <div className="section-heading">
                  <h3>Assign admin role</h3>
                </div>
                <div className="participant-list">
                  {participants.length === 0 ? (
                    <div className="empty-state">No registered participants yet.</div>
                  ) : (
                    participants.map((participant) => {
                      const alreadyAdmin = participant.role === 'admin' || (adminUser?.email && participant.email === adminUser.email);
                      return (
                        <div key={participant.id} className="participant-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid #e2e8f0' }}>
                          <div>
                            <strong>{participant.fullName}</strong>
                            <br />
                            <small style={{ color: '#64748b' }}>{participant.email}</small>
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

              {/* METRICAS PRINCIPALES */}
              <section className="admin-metrics">
                <article className="metric-card accent"><span>Total participants</span><strong>{stats.totalParticipants || 0}</strong></article>
                <article className="metric-card"><span>Active participants</span><strong>{stats.activeParticipants || 0}</strong></article>
                <article className="metric-card"><span>Total stamps</span><strong>{stats.totalStamps || 0}</strong></article>
                <article className="metric-card"><span>Total points</span><strong>{stats.totalPoints || 0}</strong></article>
              </section>

              {/* GRÁFICOS DE BARRAS */}
              <section className="admin-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', margin: '1.5rem 0' }}>
                <div className="admin-panel chart-panel">
                  <h3>Category activity</h3>
                  {categoryEntries.length === 0 ? (
                    <div className="empty-state">No category activity yet.</div>
                  ) : (
                    <div className="bar-chart" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                      {categoryEntries.map(([key, count]) => (
                        <div key={key} className="bar-row">
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{key}</span>
                          <div className="bar-track" style={{ background: '#f1f5f9', borderRadius: '4px', height: '10px', overflow: 'hidden', margin: '4px 0' }}>
                            <div className="bar-fill" style={{ width: `${(Number(count || 0) / maxCategoryCount) * 100}%`, background: '#0b41cd', height: '100%' }} />
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
                    <div className="bar-chart user-chart" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                      {topUsers.map((entry) => (
                        <div key={entry.id} className="bar-row">
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{entry.fullName}</span>
                          <div className="bar-track" style={{ background: '#f1f5f9', borderRadius: '4px', height: '10px', overflow: 'hidden', margin: '4px 0' }}>
                            <div
                              className="bar-fill user-fill"
                              style={{ width: `${Math.max((Number(entry.totalPoints || 0) / maxUserPoints) * 100, 8)}%`, background: '#f59e0b', height: '100%' }}
                            />
                          </div>
                          <strong>{entry.totalPoints} pts</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* REPORTES Y CSV */}
              <section className="admin-panel report-panel">
                <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>Participant report</h3>
                  <button type="button" className="small-button" onClick={() => window.open('/api/admin/report/csv', '_blank')}>Export CSV</button>
                </div>
                <div className="report-table-wrap" style={{ overflowX: 'auto', marginTop: '1rem' }}>
                  <table className="report-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}><th>Name</th><th>Email</th><th>Role</th><th>Stamps</th><th>Points</th><th>Last activity</th></tr>
                    </thead>
                    <tbody>
                      {adminReport.length === 0 ? (
                        <tr><td colSpan="6" style={{ padding: '1rem', textAlign: 'center' }}>No participant activity yet.</td></tr>
                      ) : (
                        adminReport.map((entry) => (
                          <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.5rem 0' }}>{entry.fullName}</td>
                            <td>{entry.email}</td>
                            <td>{entry.role}</td>
                            <td>{entry.totalStamps}</td>
                            <td>{entry.totalPoints}</td>
                            <td>{entry.lastActivity}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* MANAGE CHALLENGES & SPECIAL ACTIVITIES */}
          {adminTab === 'challenge' && (
            <section className="admin-panel special-challenges-panel">
              <div className="section-heading"><h3>Manage Active challenge</h3></div>
              <div className="challenge-status-card">
                <div className="challenge-status-copy">
                  <span className={`challenge-status-pill ${challengeStatus.isActive ? 'live' : 'paused'}`}>{challengeStatus.isActive ? 'Active challenge' : 'No active challenge'}</span>
                  <strong>{challengeStatus.title || 'No active challenge'}</strong>
                </div>
                <div className="admin-challenge-actions">
                  <button type="button" className="secondary-button" onClick={handleEndChallenge}>End Current Challenge Campaign</button>
                  <button type="button" className="primary-button" onClick={handleStartChallenge}>Create New Challenge Campaign</button>
                </div>
              </div>

              <div className="section-heading special-activities-heading"><h3>Add Special Activity</h3></div>
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
                      <div key={ch.id} className="admin-community-item">
                        <div><strong>{ch.title}</strong> <small>{ch.points} pts</small></div>
                        <p>{ch.description}</p>
                        <small className="challenge-code">{ch.scanCode}</small>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {/* COMMUNITY MANAGEMENT */}
          {adminTab === 'community' && (
            <section className="admin-panel community-admin-panel">
              <div className="section-heading"><h3>Community management</h3></div>
              <div className="community-manager-grid">
                <div className="community-manager-form">
                  <textarea value={adminCommunityDraft.message} onChange={(e) => setAdminCommunityDraft({ ...adminCommunityDraft, message: e.target.value })} placeholder="Publish an announcement..." />
                  <button type="button" className="primary-button" onClick={handleAdminCommunityPostSubmit}>Publish update</button>
                </div>
                <div className="community-manager-list">
                  {adminCommunityPosts.length === 0 ? <div className="empty-state">No community posts yet.</div> : (
                    adminCommunityPosts.map((post) => (
                      <div key={post.id} className="admin-community-item">
                        <div><strong>{post.author}</strong> <small>{post.isAnnouncement ? 'Announcement' : 'Community post'}</small></div>
                        <p>{post.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {/* CATEGORY QR CODES */}
          {adminTab === 'qr' && (
            <section className="admin-panel qr-panel qr-sheet">
              <div className="section-heading qr-header"><h3>Category QR codes</h3></div>
              <div className="qr-grid qr-sheet-grid">
                {adminQrCodes.length === 0 ? <div className="empty-state">Loading QR codes…</div> : (
                  adminQrCodes.map((item) => (
                    <div key={item.id} className="qr-card">
                      <img src={item.qrCode} alt={item.title} className="qr-image" />
                      <strong>{item.title}</strong>
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
            <div className="portal-tabs">
              <button type="button" className={`portal-nav-button ${activePortalTab === 'passport' ? 'active' : ''}`} onClick={() => setActivePortalTab('passport')}>Digital Passport</button>
              <button type="button" className={`portal-nav-button ${activePortalTab === 'community' ? 'active' : ''}`} onClick={() => setActivePortalTab('community')}>Wellness Community</button>
              <button type="button" className={`portal-nav-button ${activePortalTab === 'challenge' ? 'active' : ''}`} onClick={() => setActivePortalTab('challenge')}>Special Activities</button>
            </div>
          </nav>

          <div className="portal-content">
            {/* DIGITAL PASSPORT TAB */}
            {activePortalTab === 'passport' && (
              <>
                <header className="passport-header">
                  <div className="header-topline">
                    <div>
                      <p className="eyebrow">Wellness Passport</p>
                      <h1>Welcome, {currentUser?.fullName || 'participant'}</h1>
                    </div>
                    <div className="header-actions">
                      <button type="button" className="logout-button" onClick={handleLogout}><LogOut className="button-icon" /> Log out</button>
                    </div>
                  </div>
                  <div className="points-panel">
                    <div className="points-row">
                      <span>Total Points</span>
                      <strong>{points} pts</strong>
                    </div>
                  </div>
                </header>

                <main className="category-list">
                  {categories.map((category) => {
                    const method = categorySelections[category.id]?.method || 'scan';
                    const scanValue = (scanEntries[category.id] || '').trim().toUpperCase();
                    const isReady = method === 'scan' ? Boolean(scanValue) : Boolean(proofs[category.id]);
                    const canLogActivity = challengeStatus.isActive && isReady;
                    const Icon = category.iconType === 'dumbbell' ? Dumbbell : category.iconType === 'users' ? Users : Trophy;

                    return (
                      <article key={category.id} className="category-card">
                        <div className="card-topline">
                          <div className="category-title-wrap">
                            <div className="icon-badge"><Icon className="category-icon" /></div>
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

                        <div className="method-toggle">
                          <button type="button" className={method === 'scan' ? 'active' : ''} onClick={() => setCategorySelections((prev) => ({ ...prev, [category.id]: { method: 'scan' } }))}>
                            <ScanLine className="button-icon" /> Scan code
                          </button>
                          <button type="button" className={method === 'upload' ? 'active' : ''} onClick={() => setCategorySelections((prev) => ({ ...prev, [category.id]: { method: 'upload' } }))}>
                            <Upload className="button-icon" /> Upload proof
                          </button>
                        </div>

                        {method === 'scan' ? (
                          <div className="scan-box">
                            <button type="button" className="scan-camera-button" onClick={() => setScannerCategoryId(category.id)}>
                              <ScanLine className="button-icon" /> Scan code with camera
                            </button>
                          </div>
                        ) : (
                          <label className="upload-box">
                            <input type="file" accept="image/*" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setProofs((prev) => ({ ...prev, [category.id]: URL.createObjectURL(file) }));
                                setCategorySelections((prev) => ({ ...prev, [category.id]: { method: 'upload' } }));
                              }
                            }} />
                            <span className="upload-hint">{category.proofPrompt}</span>
                          </label>
                        )}

                        <button type="button" className="log-button" onClick={() => addStamp(category)} disabled={!canLogActivity}>
                          <PlusCircle className="button-icon" /> Log in Activity
                        </button>
                      </article>
                    );
                  })}
                </main>

                <section className="stamp-panel">
                  <div className="section-heading"><h3>Stamp History</h3></div>
                  {!(currentUser?.stamps?.length) ? (
                    <div className="empty-state">No stamps yet. Scan code or upload photo proof to log your activity.</div>
                  ) : (
                    <div className="stamp-list">
                      {currentUser.stamps.map((stamp) => {
                        const { Icon, background, color } = getStampBadge(stamp.title);
                        return (
                          <div key={stamp.id} className="stamp-item">
                            <div className="stamp-badge" style={{ background, color }}><Icon className="stamp-badge-icon" /></div>
                            <div className="stamp-copy">
                              <div className="stamp-title-row">
                                <span className="stamp-title">{stamp.title}</span>
                                <span className="stamp-points">+{stamp.points} pt</span>
                              </div>
                              <span className="stamp-time">{new Date(stamp.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}

            {/* WELLNESS COMMUNITY TAB */}
            {activePortalTab === 'community' && (
              <section className="community-panel">
                <div className="section-heading">
                  <h3>Wellness Community</h3>
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
                      <img src={communityDraft.image} alt="Upload preview" className="community-preview" />
                    </div>
                  ) : null}
                </div>

                <div className="community-feed">
                  {communityPosts.length === 0 ? (
                    <div className="empty-state">No community posts yet. Be the first to share an update!</div>
                  ) : (
                    communityPosts.map((post) => (
                      <article key={post.id} className="community-post">
                        <div className="community-post-header">
                          <div>
                            <strong>{post.author}</strong>
                            <small>{post.role === 'admin' ? 'Admin' : 'Participant'}</small>
                          </div>
                          <span>{post.createdAt}</span>
                        </div>
                        {post.message ? <p>{post.message}</p> : null}
                        {post.image ? <img src={post.image} alt="Post content" className="community-post-image" /> : null}
                      </article>
                    ))
                  )}
                </div>
              </section>
            )}

            {/* SPECIAL ACTIVITIES TAB */}
            {activePortalTab === 'challenge' && (
              <section className="challenge-panel">
                <div className="section-heading">
                  <h3>Special Activities</h3>
                </div>

                {!selectedChallenge ? (
                  <div className="challenge-grid">
                    {specialChallenges.length === 0 ? (
                      <div className="empty-state">No special activities available at the moment.</div>
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
                      <p>{selectedChallenge.description}</p>
                      <div className="scan-box challenge-scan-box">
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
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setProofs((prev) => ({ ...prev, [selectedChallenge.id]: URL.createObjectURL(file) }));
                            }
                          }}
                        />
                        <span className="upload-hint">{selectedChallenge.proofPrompt || 'Upload a photo proof'}</span>
                      </label>

                      {proofs[selectedChallenge.id] ? (
                        <div className="proof-preview-wrap">
                          <img src={proofs[selectedChallenge.id]} alt="Proof preview" className="proof-preview" />
                        </div>
                      ) : null}

                      <button
                        type="button"
                        className="log-button"
                        onClick={() => addStamp(selectedChallenge)}
                        disabled={!challengeStatus.isActive}
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

      {scannerCategoryId && (
        <div className="scanner-modal">
          <div className="scanner-card">
            <button type="button" className="close-scanner" onClick={() => setScannerCategoryId(null)}>Close</button>
            <video ref={videoRef} className="scanner-video" autoPlay playsInline muted />
            <canvas ref={canvasRef} hidden />
          </div>
        </div>
      )}
    </div>
  );
}
