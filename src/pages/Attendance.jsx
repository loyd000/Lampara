import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { Link } from 'react-router-dom';
import { loadOpenCV, detectFace, drawDetection, isOpenCVReady } from '../lib/opencv-face-detector.js';
import './Attendance.css';

const MODEL_URL = '/models';

/* Lazy-load face-api only when needed for descriptor work */
let _faceapi = null;
let _faceapiPromise = null;
async function getFaceApi() {
    if (_faceapi) return _faceapi;
    if (_faceapiPromise) return _faceapiPromise;
    _faceapiPromise = (async () => {
        const mod = await import('@vladmandic/face-api');
        _faceapi = mod.default || mod;
        await Promise.all([
            _faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            _faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            _faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        return _faceapi;
    })();
    return _faceapiPromise;
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ============================================================
   Root
   screens: login | register | pending | rejected | welcome |
            camera | confirm | success
   ============================================================ */
export default function Attendance() {
    const [cvReady, setCvReady] = useState(false);
    const [modelError, setModelError] = useState('');
    const [screen, setScreen] = useState('login');
    const [currentWorker, setCurrentWorker] = useState(null);
    const [lastAction, setLastAction] = useState(null);
    const [successData, setSuccessData] = useState(null);
    const [liveTime, setLiveTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setLiveTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        loadOpenCV()
            .then(() => setCvReady(true))
            .catch(err => setModelError('Failed to load OpenCV: ' + err.message));
    }, []);

    const [pendingOT, setPendingOT] = useState(false);

    // Auto clock-out: close any open clock-in older than 8 hours
    const autoClockOut = async (workerId) => {
        const { data: last } = await supabase
            .from('attendance_logs')
            .select('id, action, logged_at, type')
            .eq('worker_id', workerId)
            .order('logged_at', { ascending: false })
            .limit(1);
        const entry = last?.[0];
        if (!entry || entry.action !== 'time_in') return entry || null;

        const elapsed = Date.now() - new Date(entry.logged_at).getTime();
        const EIGHT_HOURS = 8 * 60 * 60 * 1000;
        if (elapsed > EIGHT_HOURS) {
            const autoOutTime = new Date(new Date(entry.logged_at).getTime() + EIGHT_HOURS);
            await supabase.from('attendance_logs').insert({
                worker_id: workerId,
                action: 'time_out',
                type: entry.type || 'regular',
                logged_at: autoOutTime.toISOString(),
                date: autoOutTime.toISOString().split('T')[0],
            });
            // Return the newly inserted time_out as last action
            return { action: 'time_out', logged_at: autoOutTime.toISOString(), type: entry.type || 'regular' };
        }
        return entry;
    };

    const handleLogin = async (worker) => {
        if (worker.__statusRedirect) {
            setScreen(worker.__statusRedirect);
            return;
        }
        const lastEntry = await autoClockOut(worker.id);
        setCurrentWorker(worker);
        setLastAction(lastEntry);
        setPendingOT(false);
        setScreen('welcome');
    };

    const handleFaceVerified = useCallback(() => {
        setScreen('confirm');
    }, []);

    const handleRecord = async (action, type = 'regular') => {
        const { error } = await supabase.from('attendance_logs').insert({
            worker_id: currentWorker.id,
            action,
            type,
            logged_at: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
        });
        if (!error) {
            setSuccessData({ worker: currentWorker, action, time: new Date(), type });
            setScreen('success');
        }
    };

    const handleStartOT = () => {
        setPendingOT(true);
        setScreen('camera'); // face scan again for OT
    };

    const logout = () => {
        setScreen('login');
        setCurrentWorker(null);
        setLastAction(null);
        setSuccessData(null);
    };

    const handleDone = async () => {
        const { data } = await supabase
            .from('attendance_logs')
            .select('action, logged_at, type')
            .eq('worker_id', currentWorker.id)
            .order('logged_at', { ascending: false })
            .limit(1);
        setLastAction(data?.[0] || null);
        setSuccessData(null);
        setPendingOT(false);
        setScreen('welcome');
    };

    const formatTime = (d) =>
        d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    const formatDate = (d) =>
        d.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="att-root">
            <header className="att-header">
                <div className="att-header__logo">
                    <img src="/assets/logo.png" alt="Lampara" onError={(e) => { e.target.style.display = 'none'; }} />
                    <span>Lampara</span>
                </div>
                <Link to="/" className="att-header__link">← Back to site</Link>
            </header>

            <div className="att-card">
                {modelError && <div className="att-error-msg" style={{ marginBottom: 'var(--sp-4)' }}>{modelError}</div>}

                {screen === 'login' && (
                    <LoginScreen
                        time={formatTime(liveTime)}
                        date={formatDate(liveTime)}
                        onLogin={handleLogin}
                        onRegister={() => setScreen('register')}
                    />
                )}

                {screen === 'register' && (
                    <RegisterScreen
                        cvReady={cvReady}
                        onBack={() => setScreen('login')}
                        onSubmitted={() => setScreen('pending')}
                    />
                )}

                {screen === 'pending' && (
                    <StatusScreen
                        type="pending"
                        onBack={() => setScreen('login')}
                    />
                )}

                {screen === 'rejected' && (
                    <StatusScreen
                        type="rejected"
                        onBack={() => setScreen('login')}
                    />
                )}

                {screen === 'welcome' && currentWorker && (
                    <WelcomeScreen
                        worker={currentWorker}
                        time={formatTime(liveTime)}
                        date={formatDate(liveTime)}
                        cvReady={cvReady}
                        onStart={() => setScreen('camera')}
                        onLogout={logout}
                    />
                )}

                {screen === 'camera' && currentWorker && cvReady && (
                    <CameraScreen
                        worker={currentWorker}
                        onVerified={handleFaceVerified}
                        onCancel={() => setScreen('welcome')}
                    />
                )}

                {screen === 'confirm' && currentWorker && (
                    <ConfirmScreen
                        worker={currentWorker}
                        lastAction={lastAction}
                        pendingOT={pendingOT}
                        onRecord={handleRecord}
                        onStartOT={handleStartOT}
                        onRetry={() => setScreen('camera')}
                    />
                )}

                {screen === 'success' && successData && (
                    <SuccessScreen
                        data={successData}
                        onDone={handleDone}
                        formatTime={formatTime}
                    />
                )}
            </div>
        </div>
    );
}

/* ============================================================
   Login Screen
   ============================================================ */
function LoginScreen({ time, date, onLogin, onRegister }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const hash = await hashPassword(password);
            const { data, error: rpcError } = await supabase.rpc('worker_login', {
                p_email: email.toLowerCase().trim(),
                p_password_hash: hash,
            });

            if (rpcError) throw rpcError;

            if (!data || data.length === 0) {
                setError('Invalid email or password.');
                setLoading(false);
                return;
            }

            const worker = data[0];
            if (worker.status === 'pending') {
                setError('');
                setLoading(false);
                onLogin({ __statusRedirect: 'pending' });
                return;
            }
            if (worker.status === 'rejected') {
                setError('Your account has been rejected. Please contact admin.');
                setLoading(false);
                return;
            }
            onLogin(worker);
        } catch (err) {
            setError(err.message || 'Login failed.');
        }
        setLoading(false);
    };

    return (
        <div className="att-auth">
            <div className="att-auth__clock">
                <div className="att-welcome__time">{time}</div>
                <div className="att-welcome__date">{date}</div>
            </div>

            <div className="att-auth__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
            </div>
            <h2 style={{ color: '#fff', marginBottom: 'var(--sp-1)' }}>Worker Sign In</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', marginBottom: 'var(--sp-6)' }}>Sign in to record your attendance</p>

            <form onSubmit={handleSubmit} className="att-form">
                <div className="att-field">
                    <label>Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        placeholder="your@email.com"
                        autoComplete="email"
                    />
                </div>
                <div className="att-field">
                    <label>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        autoComplete="current-password"
                    />
                </div>
                {error && <div className="att-error-msg">{error}</div>}
                <button type="submit" className="att-btn-primary" disabled={loading}>
                    {loading ? 'Signing in…' : 'Sign In'}
                </button>
            </form>

            <div className="att-divider"><span>or</span></div>

            <button className="att-btn-secondary" onClick={onRegister}>
                Create an Account
            </button>
        </div>
    );
}

/* ============================================================
   Register Screen
   ============================================================ */
function RegisterScreen({ cvReady, onBack, onSubmitted }) {
    const [form, setForm] = useState({ name: '', employee_id: '', position: '', email: '', password: '', confirmPassword: '' });
    const [descriptor, setDescriptor] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [captureStatus, setCaptureStatus] = useState('');
    const [captureStatusType, setCaptureStatusType] = useState('warn');
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const detectionRef = useRef(null);

    const startCamera = async () => {
        setError('');
        if (!cvReady) { setError('Face detection is still loading. Please wait.'); return; }
        setCaptureStatus('Starting camera…');
        setCaptureStatusType('warn');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            streamRef.current = stream;
            setCameraActive(true); // mount the <video> element first
        } catch {
            setCaptureStatus('Camera access denied.');
            setCaptureStatusType('err');
        }
    };

    // After cameraActive=true the <video> element is in the DOM — now attach stream
    useEffect(() => {
        if (!cameraActive || !streamRef.current || !videoRef.current) return;
        const video = videoRef.current;
        video.srcObject = streamRef.current;
        const setup = () => {
            video.play().catch(() => {});
            setCaptureStatus('Look straight at the camera, then click Capture');
            startLoop();
        };
        if (video.readyState >= 1) setup();
        else video.onloadedmetadata = setup;
    }, [cameraActive]); // eslint-disable-line react-hooks/exhaustive-deps

    const startLoop = () => {
        detectionRef.current = setInterval(() => {
            const video = videoRef.current;
            if (!video || video.readyState < 2) return;
            const rect = detectFace(video);
            drawDetection(canvasRef.current, video, rect);
            if (rect) {
                setCaptureStatus('Face detected — click Capture');
                setCaptureStatusType('ok');
            } else {
                setCaptureStatus('No face detected. Adjust your position.');
                setCaptureStatusType('warn');
            }
        }, 100);
    };

    const capture = async () => {
        const video = videoRef.current;
        if (!video) return;
        setCaptureStatus('Processing face…');
        setCaptureStatusType('warn');
        try {
            const faceapi = await getFaceApi();
            const det = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
                .withFaceLandmarks()
                .withFaceDescriptor();
            if (!det) { setCaptureStatus('No face detected. Try again.'); setCaptureStatusType('err'); return; }
            setDescriptor(Array.from(det.descriptor));
            setCaptureStatus('Face captured!');
            setCaptureStatusType('ok');
            stopCamera();
        } catch (err) {
            setCaptureStatus('Error processing face: ' + err.message);
            setCaptureStatusType('err');
        }
    };

    const stopCamera = () => {
        clearInterval(detectionRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
        setCameraActive(false);
    };

    useEffect(() => () => {
        clearInterval(detectionRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
        if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
        if (!descriptor) { setError('Please capture your face photo first.'); return; }
        setSaving(true);
        try {
            const hash = await hashPassword(form.password);
            const { error: err } = await supabase.from('workers').insert({
                name: form.name.trim(),
                employee_id: form.employee_id.trim(),
                position: form.position.trim(),
                email: form.email.toLowerCase().trim(),
                password_hash: hash,
                face_descriptor: descriptor,
                status: 'pending',
            });
            if (err) throw err;
            onSubmitted();
        } catch (err) {
            setError(err.message);
        }
        setSaving(false);
    };

    return (
        <div className="att-auth">
            <button className="att-back-btn" onClick={onBack}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Sign In
            </button>

            <h2 style={{ color: '#fff', marginBottom: 'var(--sp-1)', marginTop: 'var(--sp-3)' }}>Create Account</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', marginBottom: 'var(--sp-6)' }}>Your account will need admin approval before you can sign in.</p>

            <form onSubmit={handleSubmit} className="att-form">
                <div className="att-field">
                    <label>Full Name *</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Juan dela Cruz" />
                </div>
                <div className="att-field">
                    <label>Employee ID *</label>
                    <input value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} required placeholder="EMP-001" />
                </div>
                <div className="att-field">
                    <label>Position / Role</label>
                    <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="e.g. Solar Installer" />
                </div>
                <div className="att-field">
                    <label>Email *</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="your@email.com" autoComplete="email" />
                </div>
                <div className="att-field">
                    <label>Password *</label>
                    <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required placeholder="At least 6 characters" autoComplete="new-password" />
                </div>
                <div className="att-field">
                    <label>Confirm Password *</label>
                    <input type="password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} required placeholder="Repeat password" autoComplete="new-password" />
                </div>

                <div className="att-field">
                    <label>Face Photo {descriptor ? <span style={{ color: 'var(--success)', marginLeft: 6 }}>✓ Captured</span> : '(required) *'}</label>
                    {cameraActive ? (
                        <div>
                            <div className="reg-camera-wrap" style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 'var(--sp-2)' }}>
                                <video ref={videoRef} muted playsInline autoPlay style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }} />
                                <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, transform: 'scaleX(-1)', width: '100%', height: '100%' }} />
                                <div className="reg-capture-overlay"><div className="reg-capture-frame"><span /></div></div>
                            </div>
                            <p className={`reg-status reg-status--${captureStatusType}`}>{captureStatus}</p>
                            <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                                <button type="button" className="att-btn-primary" style={{ flex: 1 }} onClick={capture}>Capture Face</button>
                                <button type="button" className="att-btn-secondary" style={{ width: 'auto', flex: '0 0 auto', padding: '0 var(--sp-4)' }} onClick={stopCamera}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            {descriptor
                                ? <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                                    <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>✓ Face captured</span>
                                    <button type="button" className="att-btn-secondary" style={{ width: 'auto', padding: '6px 14px', fontSize: '0.8rem' }} onClick={startCamera}>Retake</button>
                                  </div>
                                : <button type="button" className="att-btn-secondary" onClick={startCamera}>Open Camera</button>
                            }
                            {captureStatus && !cameraActive && (
                                <p className={`reg-status reg-status--${captureStatusType}`} style={{ marginTop: 'var(--sp-2)' }}>{captureStatus}</p>
                            )}
                        </div>
                    )}
                </div>

                {error && <div className="att-error-msg">{error}</div>}

                <button type="submit" className="att-btn-primary" disabled={saving || !descriptor}>
                    {saving ? 'Submitting…' : 'Submit Registration'}
                </button>
            </form>
        </div>
    );
}

/* ============================================================
   Status Screen — pending / rejected
   ============================================================ */
function StatusScreen({ type, onBack }) {
    const isPending = type === 'pending';
    return (
        <div className="att-welcome" style={{ paddingTop: 'var(--sp-4)' }}>
            <div className="att-welcome__icon" style={isPending
                ? { background: 'rgba(201,168,76,0.1)', borderColor: 'rgba(201,168,76,0.3)' }
                : { background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }
            }>
                {isPending ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--gold)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--error)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                )}
            </div>
            <h2 style={{ color: '#fff' }}>{isPending ? 'Awaiting Approval' : 'Account Rejected'}</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 'var(--sp-8)' }}>
                {isPending
                    ? 'Your registration has been submitted. Please wait for the admin to approve your account before signing in.'
                    : 'Your account registration was not approved. Please contact the administrator for assistance.'
                }
            </p>
            <button className="att-btn-primary" onClick={onBack}>Back to Sign In</button>
        </div>
    );
}

/* ============================================================
   Welcome Screen (post-login)
   ============================================================ */
function WelcomeScreen({ worker, time, date, cvReady, onStart, onLogout }) {
    const initials = worker.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return (
        <div className="att-welcome">
            <div className="att-welcome__time">{time}</div>
            <div className="att-welcome__date">{date}</div>
            <div className="att-confirm__avatar" style={{ margin: '0 auto var(--sp-4)' }}>{initials}</div>
            <h2 style={{ color: '#fff', marginBottom: 'var(--sp-1)' }}>Hello, {worker.name.split(' ')[0]}!</h2>
            <p style={{ marginBottom: 'var(--sp-8)' }}>{worker.position || 'Worker'} &nbsp;·&nbsp; ID: {worker.employee_id}</p>
            {!cvReady ? (
                <div className="att-loading">
                    <div className="att-loading__spinner" />
                    <p>Loading face detection…</p>
                </div>
            ) : (
                <button className="att-btn-primary" onClick={onStart}>
                    Start Face Scan
                </button>
            )}
            <button className="att-btn-secondary" onClick={onLogout} style={{ marginTop: 'var(--sp-3)' }}>Sign Out</button>
        </div>
    );
}

/* ============================================================
   Camera Screen — verifies the logged-in worker's face
   ============================================================ */
function CameraScreen({ worker, onVerified, onCancel }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const intervalRef = useRef(null);
    const [status, setStatus] = useState('scanning');
    const [statusMsg, setStatusMsg] = useState('Position your face in the frame');
    const verifiedRef = useRef(false);

    useEffect(() => {
        let mounted = true;
        navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
        }).then(stream => {
            if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play();
                    startDetection();
                };
            }
        }).catch(() => {
            if (mounted) { setStatus('error'); setStatusMsg('Camera access denied.'); }
        });
        return () => {
            mounted = false;
            clearTimeout(intervalRef.current);
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    // Resume detection when user returns to this tab
    useEffect(() => {
        const onVisible = () => {
            if (document.hidden || verifiedRef.current) return;
            const video = videoRef.current;
            if (video && video.paused) video.play().catch(() => {});
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, []);

    const startDetection = () => {
        if (!worker.face_descriptor || worker.face_descriptor.length !== 128) {
            setStatus('error');
            setStatusMsg('No face data on file. Contact admin.');
            return;
        }
        const targetDescriptor = new Float32Array(worker.face_descriptor);
        let isVerifying = false; // guard against overlapping face-api calls

        const detect = () => {
            if (verifiedRef.current || !videoRef.current) return;
            const video = videoRef.current;

            if (document.hidden || video.paused || video.readyState < 2) {
                intervalRef.current = setTimeout(detect, 200);
                return;
            }

            // Fast OpenCV detection
            const rect = detectFace(video);
            drawDetection(canvasRef.current, video, rect);

            if (!rect) {
                setStatus('scanning');
                setStatusMsg('Position your face in the frame');
                intervalRef.current = setTimeout(detect, 100);
                return;
            }

            // Face found by OpenCV — now do heavy descriptor work with face-api
            if (isVerifying) {
                intervalRef.current = setTimeout(detect, 200);
                return;
            }

            setStatus('detected');
            setStatusMsg('Verifying identity…');
            isVerifying = true;

            getFaceApi().then(async (faceapi) => {
                if (verifiedRef.current) return;

                const detection = await faceapi
                    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (verifiedRef.current) return;
                isVerifying = false;

                if (!detection) {
                    setStatus('scanning');
                    setStatusMsg('Position your face in the frame');
                    intervalRef.current = setTimeout(detect, 100);
                    return;
                }

                const distance = faceapi.euclideanDistance(detection.descriptor, targetDescriptor);
                if (distance > 0.6) {
                    setStatus('nomatch');
                    setStatusMsg('Face does not match. Try again.');
                    intervalRef.current = setTimeout(() => {
                        setStatus('scanning');
                        setStatusMsg('Position your face in the frame');
                        intervalRef.current = setTimeout(detect, 200);
                    }, 2000);
                    return;
                }

                verifiedRef.current = true;
                clearTimeout(intervalRef.current);
                streamRef.current?.getTracks().forEach(t => t.stop());
                setStatus('matched');
                setStatusMsg('Identity verified!');
                setTimeout(onVerified, 700);
            }).catch(() => {
                isVerifying = false;
                intervalRef.current = setTimeout(detect, 500);
            });
        };

        intervalRef.current = setTimeout(detect, 200);
    };

    const statusClass = {
        scanning: 'att-camera__status--scanning',
        detected: 'att-camera__status--detected',
        matched: 'att-camera__status--matched',
        nomatch: 'att-camera__status--error',
        error: 'att-camera__status--error',
    }[status] || 'att-camera__status--scanning';

    return (
        <div className="att-camera">
            <div className="att-camera__label">Verifying Identity — {worker.name}</div>
            <div className={`att-camera__container ${status === 'scanning' ? 'scanning' : ''}`}>
                <video ref={videoRef} className="att-camera__video" muted playsInline autoPlay />
                <canvas ref={canvasRef} className="att-camera__canvas" />
                <div className="att-camera__overlay">
                    <div className="att-camera__frame"><span /></div>
                </div>
            </div>
            <p className={`att-camera__status ${statusClass}`}>
                {statusMsg}
                {status === 'scanning' && (
                    <span className="att-dots"><span /><span /><span /></span>
                )}
            </p>
            <button className="att-btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
    );
}

/* ============================================================
   Confirm Screen — enforces clock-in/out rules + OT
   ============================================================ */
function ConfirmScreen({ worker, lastAction, pendingOT, onRecord, onStartOT, onRetry }) {
    const [submitting, setSubmitting] = useState(false);
    const initials = worker.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    // Determine state
    const isClockedIn = lastAction?.action === 'time_in';
    const isClockedOut = lastAction?.action === 'time_out' || !lastAction;
    const lastType = lastAction?.type || 'regular';

    const lastActionText = lastAction
        ? `Last: ${lastAction.action === 'time_in' ? 'Clocked In' : 'Clocked Out'}${lastType === 'overtime' ? ' (OT)' : ''} at ${new Date(lastAction.logged_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}`
        : 'No previous record today';

    const handle = async (action, type = 'regular') => {
        setSubmitting(true);
        await onRecord(action, type);
        setSubmitting(false);
    };

    // If we arrived here after an OT face scan
    if (pendingOT) {
        return (
            <div className="att-confirm">
                <div className="att-confirm__avatar">{initials}</div>
                <div className="att-confirm__name">{worker.name}</div>
                <div className="att-confirm__role">{worker.position || 'Worker'}</div>
                <div className="att-confirm__id">ID: {worker.employee_id}</div>
                <div className="att-confirm__last" style={{ color: 'var(--gold)' }}>Overtime Clock In</div>
                <div className="att-confirm__actions">
                    <button className="att-btn-timein" onClick={() => handle('time_in', 'overtime')} disabled={submitting} style={{ width: '100%' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0 0V8m0 4h4m-4 0H8M12 21a9 9 0 100-18 9 9 0 000 18z" />
                        </svg>
                        Start Overtime
                        <span className="att-btn-sub">OT Rate: 125%</span>
                    </button>
                </div>
                <button className="att-btn-secondary" onClick={onRetry}>Re-scan face</button>
            </div>
        );
    }

    return (
        <div className="att-confirm">
            <div className="att-confirm__avatar">{initials}</div>
            <div className="att-confirm__name">{worker.name}</div>
            <div className="att-confirm__role">{worker.position || 'Worker'}</div>
            <div className="att-confirm__id">ID: {worker.employee_id}</div>
            <div className="att-confirm__last">{lastActionText}</div>
            <div className="att-confirm__actions">
                {isClockedIn ? (
                    /* Currently clocked in — only allow Time Out */
                    <button className="att-btn-timeout" onClick={() => handle('time_out', lastType)} disabled={submitting} style={{ width: '100%' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m0 0l3-3m-3 3l3 3M12 21a9 9 0 100-18 9 9 0 000 18z" />
                        </svg>
                        {lastType === 'overtime' ? 'End Overtime' : 'Time Out'}
                        <span className="att-btn-sub">{lastType === 'overtime' ? 'OT Clock Out' : 'Clock Out'}</span>
                    </button>
                ) : (
                    /* Not clocked in — only allow Time In */
                    <button className="att-btn-timein" onClick={() => handle('time_in')} disabled={submitting} style={{ width: '100%' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0 0V8m0 4h4m-4 0H8M12 21a9 9 0 100-18 9 9 0 000 18z" />
                        </svg>
                        Time In
                        <span className="att-btn-sub">Clock In</span>
                    </button>
                )}
            </div>
            {/* Show OT button after clocking out from regular shift */}
            {isClockedOut && lastAction && lastType === 'regular' && (
                <button className="att-btn-primary" onClick={onStartOT} style={{ marginTop: 'var(--sp-3)', background: 'var(--gold)', color: '#000', width: '100%' }}>
                    ⏱ Start Overtime (125% rate)
                </button>
            )}
            <button className="att-btn-secondary" onClick={onRetry} style={{ marginTop: 'var(--sp-3)' }}>Re-scan face</button>
        </div>
    );
}

/* ============================================================
   Success Screen
   ============================================================ */
function SuccessScreen({ data, onDone, formatTime }) {
    const isIn = data.action === 'time_in';
    useEffect(() => {
        const t = setTimeout(onDone, 6000);
        return () => clearTimeout(t);
    }, [onDone]);
    return (
        <div className="att-success">
            <div className={`att-success__icon ${isIn ? 'att-success__icon--in' : 'att-success__icon--out'}`}>
                {isIn ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                )}
            </div>
            <h2>{isIn ? 'Clocked In!' : 'Clocked Out!'}</h2>
            <div className="att-success__worker">{data.worker.name}</div>
            <div className="att-success__time">{formatTime(data.time)}</div>
            <button className="att-btn-primary" onClick={onDone}>Done</button>
        </div>
    );
}
