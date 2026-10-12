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

  const refreshAllData = async () => {
    try {
      const [parts, comms, chs, status] = await Promise.all([
        fetchJson('/api/participants'),
        fetchJson('/api/admin/community'),
        fetchJson('/api/challenges'),
        fetchJson('/api/admin/challenge-status')
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
      const [stats, qrs, rep] = await Promise.all([
        fetchJson('/api/admin/stats'),
        fetchJson('/api/admin/qr-codes'),
        fetchJson('/api/admin/report')
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

    return () => clearInterval(interval);
  }, [currentUser?.id, adminUser?.id]);

  useEffect(() => {
    if (adminUser) refreshAdminData();
  }, [adminUser]);

  useEffect(() => {
    if (currentUser) {
      window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
      setAccountDraft({
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

  const addStamp = async (activity) => {
    if (!currentUser) return;
    try {
      const res = await fetchJson(`/api/participants/${currentUser.id}/stamps`, {
        method: 'POST',
        body: JSON.stringify({
          title: activity.title,
          points: activity.points,
          categoryId: activity.id || 'special',
          scanCode: scanEntries[activity.id] || activity.scanCode || ''
        })
      });
      setCurrentUser(res.user);
      setFormError('');
      setProofs((p) => { const n = { ...p }; delete n[activity.id]; return n; });
      setScanEntries((p) => { const n = { ...p }; delete n[activity.id]; return n; });
      confetti({ particleCount: 55, spread: 60, origin: { y: 0.8 } });
      await refreshAllData();
    } catch (err) {
      setFormError(err.message);
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

          {adminTab === 'qr' && (
            <section className="admin-panel qr-panel qr-sheet">
              <div className="qr-grid qr-sheet-grid">
                {adminQrCodes.map((item) => (
                  <div key={item.id} className="qr-card">
                    <img src={item.qrCode} alt={item.title} className="qr-image" />
                    <strong>{item.title}</strong>
                    <small>{item.code}</small>
                  </div>
                ))}
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
