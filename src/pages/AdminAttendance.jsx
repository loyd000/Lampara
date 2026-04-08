import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { loadOpenCV, detectFace, drawDetection, isOpenCVReady } from '../lib/opencv-face-detector.js';

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
            _faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            _faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            _faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        return _faceapi;
    })();
    return _faceapiPromise;
}

function downloadCSV(filename, headers, rows) {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}


/* ============================================================
   Attendance Tab — top-level, loads models once
   ============================================================ */
export default function AttendanceTab() {
    const [cvReady, setCvReady] = useState(false);
    const [modelError, setModelError] = useState('');
    const [subTab, setSubTab] = useState('workers'); // workers | logs | dtr | payroll

    useEffect(() => {
        loadOpenCV()
            .then(() => setCvReady(true))
            .catch(err => setModelError('Failed to load OpenCV: ' + err.message));
    }, []);

    return (
        <div>
            <div className="admin-tabs" style={{ marginBottom: 'var(--sp-5)' }}>
                {['workers', 'logs', 'dtr', 'payroll'].map((t) => (
                    <button
                        key={t}
                        className={`admin-tab ${subTab === t ? 'active' : ''}`}
                        onClick={() => setSubTab(t)}
                    >
                        {t === 'workers' ? 'Workers' : t === 'logs' ? 'Attendance Logs' : t === 'dtr' ? 'DTR' : 'Payroll'}
                    </button>
                ))}
            </div>

            {modelError && <p className="admin-error" style={{ marginBottom: 'var(--sp-4)' }}>{modelError}</p>}

            {!cvReady && !modelError && (
                <div className="admin-loading-inline">
                    <div className="spinner" />
                </div>
            )}

            {cvReady && (
                <>
                    {subTab === 'workers' && <WorkersTab />}
                    {subTab === 'logs' && <LogsTab />}
                    {subTab === 'dtr' && <DTRTab />}
                    {subTab === 'payroll' && <PayrollTab />}
                </>
            )}
        </div>
    );
}

/* ============================================================
   Workers Tab
   ============================================================ */
function WorkersTab() {
    const [workers, setWorkers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('workers')
            .select('id, name, employee_id, position, email, status, daily_rate, created_at')
            .order('created_at', { ascending: false });
            
        if (error) {
            console.error('Error fetching workers:', error);
            alert('Failed to load workers from Supabase: ' + error.message);
        }
        
        setWorkers(data || []);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleApprove = async (id) => {
        setError('');
        setActionLoading(id + '_approve');
        try {
            const { error: err } = await supabase.from('workers').update({ status: 'active' }).eq('id', id);
            if (err) throw err;
            await load();
        } catch (err) {
            setError(`Failed to approve worker: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id, name) => {
        if (!window.confirm(`Reject "${name}"'s registration?`)) return;
        setError('');
        setActionLoading(id + '_reject');
        try {
            const { error: err } = await supabase.from('workers').update({ status: 'rejected' }).eq('id', id);
            if (err) throw err;
            await load();
        } catch (err) {
            setError(`Failed to reject worker: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Remove worker "${name}" and all their attendance records?`)) return;
        setError('');
        try {
            const { error: logsErr } = await supabase.from('attendance_logs').delete().eq('worker_id', id);
            if (logsErr) throw new Error(`Delete logs failed: ${logsErr.message}`);
            
            const { error: workerErr } = await supabase.from('workers').delete().eq('id', id);
            if (workerErr) throw new Error(`Delete worker failed: ${workerErr.message}`);
            
            await load();
        } catch (err) {
            setError(`Failed to delete worker: ${err.message}`);
        }
    };

    const handleUpdateRate = async (id, rate) => {
        setError('');
        try {
            const { error: err } = await supabase.from('workers').update({ daily_rate: rate }).eq('id', id);
            if (err) throw err;
            await load();
        } catch (err) {
            setError(`Failed to update rate: ${err.message}`);
        }
    };

    const pending = workers.filter(w => w.status === 'pending');
    const active = workers.filter(w => w.status === 'active');
    const rejected = workers.filter(w => w.status === 'rejected');

    return (
        <div>
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 'var(--sp-3)', borderRadius: '6px', marginBottom: 'var(--sp-4)', fontSize: '0.9rem' }}>
                <strong>Error:</strong> {error}
            </div>}
            {/* ---- Pending Approvals ---- */}
            {pending.length > 0 && (
                <div style={{ marginBottom: 'var(--sp-8)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
                        <h2 style={{ fontSize: '1rem' }}>Pending Approvals</h2>
                        <span style={{
                            background: 'rgba(201,168,76,0.12)', color: 'var(--gold-dim)',
                            borderRadius: 'var(--radius-full)', padding: '2px 10px',
                            fontSize: '0.75rem', fontWeight: 600
                        }}>{pending.length}</span>
                    </div>
                    <div className="admin-workers">
                        {pending.map(w => {
                            const rawName = w.name || 'Unknown Worker';
                            const initials = rawName.split(' ').map(n => n?.[0] || '').join('').toUpperCase().slice(0, 2);
                            return (
                                <div key={w.id} className="admin-worker-card" style={{ borderColor: 'rgba(201,168,76,0.25)' }}>
                                    <div className="admin-worker-card__avatar" style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--gold-dim)' }}>
                                        {initials}
                                    </div>
                                    <div className="admin-worker-card__info">
                                        <h3>{w.name}</h3>
                                        <p>ID: {w.employee_id}{w.position ? ` · ${w.position}` : ''}</p>
                                        <p style={{ fontSize: '0.7rem', marginTop: 2 }}>{w.email}</p>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', flexShrink: 0 }}>
                                        <button
                                            className="btn btn-primary"
                                            style={{ fontSize: '0.8rem', minHeight: 34, padding: '6px 14px', background: 'var(--success)' }}
                                            disabled={actionLoading === w.id + '_approve'}
                                            onClick={() => handleApprove(w.id)}
                                        >
                                            {actionLoading === w.id + '_approve' ? '…' : 'Approve'}
                                        </button>
                                        <button
                                            className="btn btn-outline"
                                            style={{ color: 'var(--error)', borderColor: 'var(--error)', fontSize: '0.8rem', minHeight: 34, padding: '6px 14px' }}
                                            disabled={actionLoading === w.id + '_reject'}
                                            onClick={() => handleReject(w.id, w.name)}
                                        >
                                            {actionLoading === w.id + '_reject' ? '…' : 'Reject'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ---- Active Workers ---- */}
            <div className="admin-toolbar">
                <h2>Active Workers ({active.length})</h2>
                <button className="btn btn-primary" style={{ fontSize: '0.875rem' }} onClick={() => setShowModal(true)}>
                    + Add Worker
                </button>
            </div>

            {loading ? (
                <div className="admin-loading-inline"><div className="spinner" /></div>
            ) : active.length === 0 ? (
                <p className="admin-empty">No active workers yet.</p>
            ) : (
                <div className="admin-workers">
                    {active.map(w => {
                        const rawName = w.name || 'Unknown Worker';
                        const initials = rawName.split(' ').map(n => n?.[0] || '').join('').toUpperCase().slice(0, 2);
                        return (
                            <div key={w.id} className="admin-worker-card">
                                <div className="admin-worker-card__avatar">{initials}</div>
                                <div className="admin-worker-card__info">
                                    <h3>{w.name}</h3>
                                    <p>ID: {w.employee_id} {w.position ? `· ${w.position}` : ''}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--gold-dim)', marginTop: 2 }}>
                                        Rate: ₱{(w.daily_rate || 0).toLocaleString()}/day
                                    </p>
                                </div>
                                <div className="admin-worker-card__actions" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>₱</span>
                                        <input
                                            type="number"
                                            defaultValue={w.daily_rate || 0}
                                            min="0"
                                            step="0.01"
                                            style={{ width: 80, fontSize: '0.8rem', padding: '4px 6px' }}
                                            onBlur={(e) => handleUpdateRate(w.id, parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                        />
                                    </div>
                                    <button
                                        className="btn btn-outline"
                                        style={{ color: 'var(--error)', borderColor: 'var(--error)', fontSize: '0.8125rem', minHeight: 36, padding: '6px 14px' }}
                                        onClick={() => handleDelete(w.id, w.name)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showModal && (
                <RegisterWorkerModal
                    onClose={() => setShowModal(false)}
                    onSaved={() => { setShowModal(false); load(); }}
                />
            )}
        </div>
    );
}

/* ============================================================
   Register Worker Modal — face capture + form
   ============================================================ */
function RegisterWorkerModal({ onClose, onSaved }) {
    const [form, setForm] = useState({ name: '', employee_id: '', position: '', email: '', password: '', daily_rate: '' });
    const [descriptor, setDescriptor] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [cameraActive, setCameraActive] = useState(false);
    const [captureStatus, setCaptureStatus] = useState('');
    const [captureStatusType, setCaptureStatusType] = useState('warn');
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const detectionRef = useRef(null);

    const startCamera = async () => {
        setError('');
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
            startDetectionLoop();
        };
        if (video.readyState >= 1) setup();
        else video.onloadedmetadata = setup;
    }, [cameraActive]); // eslint-disable-line react-hooks/exhaustive-deps

    const startDetectionLoop = () => {
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
                .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!det) {
                setCaptureStatus('No face found. Try again.');
                setCaptureStatusType('err');
                return;
            }

            setDescriptor(Array.from(det.descriptor));
            setCaptureStatus('Face captured successfully!');
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
        if (!descriptor) { setError('Please capture the worker\'s face first.'); return; }
        if (!form.name.trim() || !form.employee_id.trim()) { setError('Name and Employee ID are required.'); return; }
        if (!form.email.trim()) { setError('Email is required.'); return; }
        if (!form.password.trim() || form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }

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
                daily_rate: parseFloat(form.daily_rate) || 0,
                status: 'active',
            });
            if (err) throw err;
            onSaved();
        } catch (err) {
            setError(err.message);
        }
        setSaving(false);
    };

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <div className="admin-modal__header">
                    <h2>Register Worker</h2>
                    <button className="admin-modal__close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="admin-modal__form">
                    <div className="admin-field">
                        <label>Full Name *</label>
                        <input
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            required
                            placeholder="e.g., Juan dela Cruz"
                        />
                    </div>
                    <div className="admin-field">
                        <label>Employee ID *</label>
                        <input
                            value={form.employee_id}
                            onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                            required
                            placeholder="e.g., EMP-001"
                        />
                    </div>
                    <div className="admin-field">
                        <label>Position / Role</label>
                        <input
                            value={form.position}
                            onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                            placeholder="e.g., Solar Installer"
                        />
                    </div>
                    <div className="admin-field">
                        <label>Email *</label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            required
                            placeholder="worker@email.com"
                        />
                    </div>
                    <div className="admin-field">
                        <label>Password *</label>
                        <input
                            type="password"
                            value={form.password}
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            required
                            placeholder="At least 6 characters"
                        />
                    </div>
                    <div className="admin-field">
                        <label>Daily Rate (₱)</label>
                        <input
                            type="number"
                            value={form.daily_rate}
                            onChange={e => setForm(f => ({ ...f, daily_rate: e.target.value }))}
                            placeholder="e.g., 700"
                            min="0"
                            step="0.01"
                        />
                    </div>

                    <div className="admin-field">
                        <label>Face Photo {descriptor ? '✓ Captured' : '(required)'}</label>
                        {cameraActive ? (
                            <>
                                <div className="reg-camera-wrap">
                                    <video ref={videoRef} muted playsInline autoPlay />
                                    <canvas ref={canvasRef} />
                                    <div className="reg-capture-overlay">
                                        <div className="reg-capture-frame"><span /></div>
                                    </div>
                                </div>
                                <p className={`reg-status reg-status--${captureStatusType}`}>{captureStatus}</p>
                                <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                                    <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={capture}>
                                        Capture Face
                                    </button>
                                    <button type="button" className="btn btn-outline" onClick={stopCamera}>
                                        Cancel
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div>
                                {descriptor ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                                        <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>✓ Face data captured</span>
                                        <button type="button" className="btn btn-outline" style={{ fontSize: '0.8rem', minHeight: 36, padding: '6px 12px' }} onClick={startCamera}>
                                            Recapture
                                        </button>
                                    </div>
                                ) : (
                                    <button type="button" className="btn btn-outline" onClick={startCamera}>
                                        Open Camera
                                    </button>
                                )}
                                {captureStatus && !cameraActive && (
                                    <p className={`reg-status reg-status--${captureStatusType}`} style={{ marginTop: 'var(--sp-2)' }}>{captureStatus}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {error && <p className="admin-error">{error}</p>}

                    <div className="admin-modal__actions">
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving || !descriptor}>
                            {saving ? 'Saving…' : 'Register Worker'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ============================================================
   Attendance Logs Tab
   ============================================================ */
function LogsTab() {
    const [logs, setLogs] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterWorker, setFilterWorker] = useState('');
    const [filterDate, setFilterDate] = useState('');

    useEffect(() => {
        let isMounted = true;
        
        const loadWorkers = async () => {
            try {
                const { data, error } = await supabase.from('workers').select('id, name').order('name');
                if (error) throw error;
                if (isMounted) {
                    setWorkers(data || []);
                }
            } catch (err) {
                console.error('Failed to load workers:', err);
            }
        };
        
        loadWorkers();
        
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        loadLogs();
    }, [filterWorker, filterDate]);

    const loadLogs = async () => {
        setLoading(true);
        let q = supabase
            .from('attendance_logs')
            .select('id, action, logged_at, date, worker_id, workers(name, employee_id)')
            .order('logged_at', { ascending: false })
            .limit(200);

        if (filterWorker) q = q.eq('worker_id', filterWorker);
        if (filterDate) q = q.eq('date', filterDate);

        const { data } = await q;
        setLogs(data || []);
        setLoading(false);
    };

    const fmtTime = (ts) => new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
    const fmtDate = (d) => {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const exportCSV = () => {
        const headers = ['Worker', 'Employee ID', 'Date', 'Time', 'Action'];
        const fmtTimeExport = (ts) => new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
        const fmtDateExport = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
        const rows = logs.map(l => [
            l.workers?.name || '',
            l.workers?.employee_id || '',
            fmtDateExport(l.date),
            fmtTimeExport(l.logged_at),
            l.action === 'time_in' ? 'Time In' : 'Time Out',
        ]);
        downloadCSV(`attendance-logs-${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
    };

    return (
        <div>
            <div className="admin-toolbar" style={{ marginBottom: 'var(--sp-4)' }}>
                <h2>Attendance Logs</h2>
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                    {logs.length > 0 && (
                        <button className="btn btn-outline" style={{ fontSize: '0.8125rem', minHeight: 36, padding: '6px 14px' }} onClick={exportCSV}>
                            Export CSV
                        </button>
                    )}
                    <button className="btn btn-outline" style={{ fontSize: '0.8125rem', minHeight: 36, padding: '6px 14px' }} onClick={loadLogs}>
                        Refresh
                    </button>
                </div>
            </div>

            <div className="att-filters">
                <select value={filterWorker} onChange={e => setFilterWorker(e.target.value)}>
                    <option value="">All Workers</option>
                    {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                {(filterWorker || filterDate) && (
                    <button className="btn btn-outline" style={{ fontSize: '0.8rem', minHeight: 36, padding: '6px 12px', flex: '0 0 auto' }} onClick={() => { setFilterWorker(''); setFilterDate(''); }}>
                        Clear
                    </button>
                )}
            </div>

            {loading ? (
                <div className="admin-loading-inline"><div className="spinner" /></div>
            ) : logs.length === 0 ? (
                <p className="admin-empty">No records found.</p>
            ) : (
                <div className="att-table-wrap">
                    <table className="att-log-table">
                        <thead>
                            <tr>
                                <th>Worker</th>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log.id}>
                                    <td>
                                        <div style={{ fontWeight: 500, color: 'var(--text)' }}>{log.workers?.name || '—'}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{log.workers?.employee_id || ''}</div>
                                    </td>
                                    <td>{fmtDate(log.date)}</td>
                                    <td>{fmtTime(log.logged_at)}</td>
                                    <td>
                                        {log.action === 'time_in'
                                            ? <span className="badge-in">Time In</span>
                                            : <span className="badge-out">Time Out</span>
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/* ============================================================
   DTR Tab
   ============================================================ */
function DTRTab() {
    const [workers, setWorkers] = useState([]);
    const [selectedWorker, setSelectedWorker] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [dtrData, setDtrData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [workerInfo, setWorkerInfo] = useState(null);

    useEffect(() => {
        let isMounted = true;
        
        const loadWorkers = async () => {
            try {
                const { data, error } = await supabase.from('workers').select('id, name, employee_id, position').order('name');
                if (error) throw error;
                if (isMounted) {
                    setWorkers(data || []);
                }
            } catch (err) {
                console.error('Failed to load workers:', err);
            }
        };
        
        loadWorkers();
        
        return () => {
            isMounted = false;
        };
    }, []);

    const generateDTR = async () => {
        if (!selectedWorker || !selectedMonth) return;
        setLoading(true);

        const [year, month] = selectedMonth.split('-').map(Number);
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

        const worker = workers.find(w => w.id === selectedWorker);
        setWorkerInfo(worker);

        const { data: logs } = await supabase
            .from('attendance_logs')
            .select('action, logged_at, date')
            .eq('worker_id', selectedWorker)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('logged_at', { ascending: true });

        // Group logs by date
        const byDate = {};
        (logs || []).forEach(log => {
            if (!byDate[log.date]) byDate[log.date] = [];
            byDate[log.date].push(log);
        });

        // Build rows for each day of the month
        const rows = [];
        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayLogs = byDate[dateStr] || [];
            const timeIn = dayLogs.find(l => l.action === 'time_in');
            const timeOut = dayLogs.findLast ? dayLogs.findLast(l => l.action === 'time_out') : dayLogs.filter(l => l.action === 'time_out').pop();

            let hours = null;
            let otHours = null;
            if (timeIn && timeOut) {
                const diff = (new Date(timeOut.logged_at) - new Date(timeIn.logged_at)) / (1000 * 60 * 60);
                const lunchBreak = diff > 5 ? 1 : 0; // 1 hr break if duration > 5
                const workedHours = Math.max(0, diff - lunchBreak);
                
                hours = Math.min(8, workedHours).toFixed(2);
                if (workedHours > 8) {
                    otHours = (workedHours - 8).toFixed(2);
                }
            }

            const dateObj = new Date(dateStr + 'T12:00:00');
            const dayName = dateObj.toLocaleDateString('en-PH', { weekday: 'short' });
            rows.push({ date: dateStr, day: d, dayName, timeIn, timeOut, hours, otHours });
        }

        setDtrData(rows);
        setLoading(false);
    };

    const fmtTime = (ts) => ts
        ? new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '—';

    const totalHours = dtrData
        ? dtrData.reduce((acc, r) => acc + (r.hours ? parseFloat(r.hours) : 0), 0).toFixed(2)
        : 0;

    const totalOtHours = dtrData
        ? dtrData.reduce((acc, r) => acc + (r.otHours ? parseFloat(r.otHours) : 0), 0).toFixed(2)
        : 0;

    const presentDays = dtrData
        ? dtrData.filter(r => r.timeIn).length
        : 0;

    const absentDays = dtrData
        ? dtrData.filter(r => !r.timeIn && r.dayName !== 'Sun').length
        : 0;

    const monthLabel = selectedMonth
        ? new Date(selectedMonth + '-01').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
        : '';

    return (
        <div>
            <div className="dtr-controls no-print">
                <select value={selectedWorker} onChange={e => setSelectedWorker(e.target.value)}>
                    <option value="">Select Worker…</option>
                    {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                    {Array.from({ length: 12 }, (_, i) => {
                        const d = new Date();
                        d.setMonth(d.getMonth() - i);
                        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        const label = d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
                        return <option key={val} value={val}>{label}</option>;
                    })}
                </select>
                <button
                    className="btn btn-primary"
                    style={{ fontSize: '0.875rem', flex: '0 0 auto' }}
                    onClick={generateDTR}
                    disabled={!selectedWorker || loading}
                >
                    {loading ? 'Loading…' : 'Generate DTR'}
                </button>
                {dtrData && (
                    <>
                        <button
                            className="btn btn-outline"
                            style={{ fontSize: '0.875rem', flex: '0 0 auto' }}
                            onClick={() => {
                                const headers = ['Day', 'Date', 'Time In', 'Time Out', 'Reg Hours', 'OT Hours', 'Remarks'];
                                const fmtT = (ts) => ts ? new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                                const rows = dtrData.map(r => {
                                    const isSunday = r.dayName === 'Sun';
                                    const isAbsent = !r.timeIn && !isSunday;
                                    return [
                                        r.dayName, r.day,
                                        fmtT(r.timeIn?.logged_at), fmtT(r.timeOut?.logged_at),
                                        r.hours ?? '',
                                        r.otHours ?? '',
                                        isSunday ? 'Rest Day' : isAbsent ? 'Absent' : r.timeIn && !r.timeOut ? 'No time-out' : '',
                                    ];
                                });
                                rows.push(['', '', '', 'Total', totalHours, totalOtHours, '']);
                                downloadCSV(`DTR-${workerInfo.name.replace(/ /g,'-')}-${selectedMonth}.csv`, headers, rows);
                            }}
                        >
                            Export CSV
                        </button>
                        <button
                            className="btn btn-outline"
                            style={{ fontSize: '0.875rem', flex: '0 0 auto' }}
                            onClick={() => window.print()}
                        >
                            Print / PDF
                        </button>
                    </>
                )}
            </div>

            {dtrData && workerInfo && (
                <>
                    <div className="dtr-header">
                        <img src="/assets/logo.png" alt="Lampara" style={{ height: 48, marginBottom: 4 }} />
                        <h2 style={{ fontSize: '1.25rem', marginBottom: 2, color: 'var(--navy)' }}>Lampara Solar Services</h2>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>123 Main St, City, Country · (123) 456-7890 · contact@lampara.com</p>
                        
                        <h3 style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12, marginTop: 12 }}>Daily Time Record</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>
                            <div style={{ textAlign: 'left' }}>
                                <p style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '1rem', margin: '4px 0' }}>{workerInfo.name}</p>
                                <p>{workerInfo.position || 'Worker'} &nbsp;·&nbsp; ID: {workerInfo.employee_id}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{monthLabel}</p>
                            </div>
                        </div>
                    </div>

                    <div className="dtr-summary">
                        <div className="dtr-summary-card">
                            <div className="dtr-summary-card__value">{presentDays}</div>
                            <div className="dtr-summary-card__label">Days Present</div>
                        </div>
                        <div className="dtr-summary-card">
                            <div className="dtr-summary-card__value">{totalHours}</div>
                            <div className="dtr-summary-card__label">Reg Hours</div>
                        </div>
                        <div className="dtr-summary-card">
                            <div className="dtr-summary-card__value" style={{ color: 'var(--gold)' }}>{totalOtHours}</div>
                            <div className="dtr-summary-card__label">OT Hours</div>
                        </div>
                    </div>

                    <div className="dtr-table-wrap">
                        <table className="dtr-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Time In</th>
                                    <th>Time Out</th>
                                    <th>Reg. Hrs</th>
                                    <th>OT Hrs</th>
                                    <th>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dtrData.map(row => {
                                    const isSunday = row.dayName === 'Sun';
                                    const isAbsent = !row.timeIn && !isSunday;
                                    return (
                                        <tr
                                            key={row.date}
                                            className={isSunday ? 'dtr-sunday' : isAbsent ? 'dtr-absent' : ''}
                                        >
                                            <td>{row.dayName}, {row.day}</td>
                                            <td>{fmtTime(row.timeIn?.logged_at)}</td>
                                            <td>{fmtTime(row.timeOut?.logged_at)}</td>
                                            <td style={{ fontWeight: 500 }}>{row.hours ?? '—'}</td>
                                            <td style={{ color: 'var(--gold-dim)', fontWeight: 600 }}>{row.otHours ?? '—'}</td>
                                            <td style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                {isSunday ? 'Rest Day' : isAbsent ? 'Absent' : row.timeIn && !row.timeOut ? 'No time-out' : ''}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan="3" style={{ textAlign: 'right', paddingRight: 'var(--sp-3)' }}>Total:</td>
                                    <td style={{ fontWeight: 700 }}>{totalHours}</td>
                                    <td style={{ fontWeight: 700, color: 'var(--gold)' }}>{totalOtHours}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="dtr-signatures" style={{ marginTop: 'var(--sp-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-8)', padding: 'var(--sp-4) 0 0 0' }}>
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-2)', textTransform: 'uppercase', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Employee Signature</p>
                        </div>
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-2)', textTransform: 'uppercase', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Verified by</p>
                        </div>
                    </div>
                </>
            )}

            {!dtrData && !loading && (
                <p className="admin-empty">Select a worker and month, then click Generate DTR.</p>
            )}
        </div>
    );
}

/* ============================================================
   Payroll Tab
   ============================================================ */
function PayrollTab() {
    const [workers, setWorkers] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [payrollData, setPayrollData] = useState(null);
    const [adjustments, setAdjustments] = useState({});  // { workerId: { sss, philhealth, ... } }
    const [loading, setLoading] = useState(false);
    const [editingWorkerId, setEditingWorkerId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [savingAdj, setSavingAdj] = useState(false);

    useEffect(() => {
        let isMounted = true;
        
        const loadWorkers = async () => {
            try {
                const { data, error } = await supabase.from('workers').select('id, name, employee_id, position, daily_rate').eq('status', 'active').order('name');
                if (error) throw error;
                if (isMounted) {
                    setWorkers(data || []);
                }
            } catch (err) {
                console.error('Failed to load workers:', err);
            }
        };
        
        loadWorkers();
        
        return () => {
            isMounted = false;
        };
    }, []);

    const generatePayroll = async () => {
        if (!selectedMonth) return;
        setLoading(true);

        const [year, month] = selectedMonth.split('-').map(Number);
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
        const monthStr = selectedMonth;

        // Fetch all attendance logs for the month
        const { data: logs } = await supabase
            .from('attendance_logs')
            .select('worker_id, action, logged_at, date, type')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('logged_at', { ascending: true });

        // Fetch adjustments for this month
        const { data: adjData } = await supabase
            .from('payroll_adjustments')
            .select('*')
            .eq('month', monthStr);

        const adjMap = {};
        (adjData || []).forEach(a => { adjMap[a.worker_id] = a; });
        setAdjustments(adjMap);

        // Process per worker
        const rows = workers.map(w => {
            const workerLogs = (logs || []).filter(l => l.worker_id === w.id);
            const rate = w.daily_rate || 0;

            // Group logs by date
            const byDate = {};
            workerLogs.forEach(l => {
                if (!byDate[l.date]) byDate[l.date] = [];
                byDate[l.date].push(l);
            });

            let daysPresent = 0;
            let regularHours = 0;
            let otHours = 0;

            Object.values(byDate).forEach(dayLogs => {
                const regIn = dayLogs.find(l => l.action === 'time_in' && (l.type === 'regular' || !l.type));
                const regOut = dayLogs.find(l => l.action === 'time_out' && (l.type === 'regular' || !l.type));
                const otIn = dayLogs.find(l => l.action === 'time_in' && l.type === 'overtime');
                const otOut = dayLogs.find(l => l.action === 'time_out' && l.type === 'overtime');

                if (regIn) daysPresent++;

                if (regIn && regOut) {
                    const diff = (new Date(regOut.logged_at) - new Date(regIn.logged_at)) / (1000 * 60 * 60);
                    regularHours += Math.min(diff, 8);
                }

                if (otIn && otOut) {
                    const diff = (new Date(otOut.logged_at) - new Date(otIn.logged_at)) / (1000 * 60 * 60);
                    otHours += Math.max(0, diff);
                }
            });

            const salary = rate * daysPresent;
            const hourlyRate = rate / 8;
            const otPay = hourlyRate * 1.25 * otHours;

            const adj = adjMap[w.id] || {};

            const nightDiff = adj.night_differential || 0;
            const incentives = adj.incentives || 0;
            const sss = adj.sss || 0;
            const philhealth = adj.philhealth || 0;
            const pagibig = adj.pagibig || 0;
            const cashAdvanceDeduction = adj.cash_advance_deduction || 0;
            const cashAdvanceBalance = adj.cash_advance_balance || 0;
            const loans = adj.loans || 0;
            const tax = adj.tax || 0;

            const totalDeductions = sss + philhealth + pagibig + cashAdvanceDeduction + loans + tax;
            const totalSalary = salary + otPay + nightDiff + incentives - totalDeductions;

            return {
                ...w,
                daysPresent,
                regularHours: regularHours.toFixed(2),
                otHours: otHours.toFixed(2),
                salary,
                otPay,
                nightDiff,
                incentives,
                sss,
                philhealth,
                pagibig,
                cashAdvanceDeduction,
                cashAdvanceBalance,
                loans,
                tax,
                totalDeductions,
                totalSalary,
            };
        });

        setPayrollData(rows);
        setLoading(false);
    };

    const openAdjEditor = (workerId) => {
        const adj = adjustments[workerId] || {};
        setEditForm({
            sss: adj.sss || 0,
            philhealth: adj.philhealth || 0,
            pagibig: adj.pagibig || 0,
            cash_advance_deduction: adj.cash_advance_deduction || 0,
            cash_advance_balance: adj.cash_advance_balance || 0,
            loans: adj.loans || 0,
            tax: adj.tax || 0,
            incentives: adj.incentives || 0,
            night_differential: adj.night_differential || 0,
        });
        setEditingWorkerId(workerId);
    };

    const saveAdjustment = async () => {
        setSavingAdj(true);
        const payload = {
            worker_id: editingWorkerId,
            month: selectedMonth,
            ...editForm,
        };
        // Upsert
        const { error } = await supabase
            .from('payroll_adjustments')
            .upsert(payload, { onConflict: 'worker_id,month' });
        if (!error) {
            setAdjustments(prev => ({ ...prev, [editingWorkerId]: { ...prev[editingWorkerId], ...payload } }));
            setEditingWorkerId(null);
            // Regenerate
            generatePayroll();
        }
        setSavingAdj(false);
    };

    const monthLabel = selectedMonth
        ? new Date(selectedMonth + '-01').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
        : '';

    const peso = (v) => '₱' + (v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const exportCSV = () => {
        if (!payrollData) return;
        const headers = [
            'Employee Name', 'Employee ID', 'Month/Year', 'Salary', 'Overtime',
            'Night Differential', 'Incentives', 'SSS', 'PhilHealth', 'Pag-IBIG',
            'Cash Advance Deduction', 'CA Remaining Balance', 'Loans', 'Tax',
            'Rate Per Day', 'Days Worked', 'Total Salary'
        ];
        const rows = payrollData.map(r => [
            r.name, r.employee_id, monthLabel, r.salary.toFixed(2), r.otPay.toFixed(2),
            r.nightDiff.toFixed(2), r.incentives.toFixed(2), r.sss.toFixed(2),
            r.philhealth.toFixed(2), r.pagibig.toFixed(2), r.cashAdvanceDeduction.toFixed(2),
            r.cashAdvanceBalance.toFixed(2), r.loans.toFixed(2), r.tax.toFixed(2),
            (r.daily_rate || 0).toFixed(2), r.daysPresent, r.totalSalary.toFixed(2),
        ]);
        downloadCSV(`Payroll-${selectedMonth}.csv`, headers, rows);
    };

    return (
        <div>
            <div className="dtr-controls no-print">
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                    {Array.from({ length: 12 }, (_, i) => {
                        const d = new Date();
                        d.setMonth(d.getMonth() - i);
                        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        const label = d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
                        return <option key={val} value={val}>{label}</option>;
                    })}
                </select>
                <button
                    className="btn btn-primary"
                    style={{ fontSize: '0.875rem', flex: '0 0 auto' }}
                    onClick={generatePayroll}
                    disabled={loading}
                >
                    {loading ? 'Loading…' : 'Generate Payroll'}
                </button>
                {payrollData && (
                    <>
                        <button className="btn btn-outline" style={{ fontSize: '0.875rem', flex: '0 0 auto' }} onClick={exportCSV}>
                            Export CSV
                        </button>
                        <button className="btn btn-outline" style={{ fontSize: '0.875rem', flex: '0 0 auto' }} onClick={() => window.print()}>
                            Print / PDF
                        </button>
                    </>
                )}
            </div>

            {payrollData && (
                <>
                    <div className="dtr-header" style={{ marginBottom: 'var(--sp-4)' }}>
                        <h3>Payroll — {monthLabel}</h3>
                    </div>

                    <div className="att-table-wrap" style={{ overflowX: 'auto' }}>
                        <table className="att-log-table" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                            <thead>
                                <tr>
                                    <th>Employee Name</th>
                                    <th>Employee ID</th>
                                    <th>Rate/Day</th>
                                    <th>Days</th>
                                    <th>Salary</th>
                                    <th>OT Hours</th>
                                    <th>OT Pay</th>
                                    <th>Night Diff</th>
                                    <th>Incentives</th>
                                    <th>SSS</th>
                                    <th>PhilHealth</th>
                                    <th>Pag-IBIG</th>
                                    <th>CA Deduction</th>
                                    <th>CA Balance</th>
                                    <th>Loans</th>
                                    <th>Tax</th>
                                    <th style={{ fontWeight: 700 }}>Total Salary</th>
                                    <th className="no-print">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payrollData.map(r => (
                                    <tr key={r.id}>
                                        <td style={{ fontWeight: 500 }}>{r.name}</td>
                                        <td>{r.employee_id}</td>
                                        <td>{peso(r.daily_rate)}</td>
                                        <td>{r.daysPresent}</td>
                                        <td>{peso(r.salary)}</td>
                                        <td>{r.otHours}</td>
                                        <td>{peso(r.otPay)}</td>
                                        <td>{peso(r.nightDiff)}</td>
                                        <td>{peso(r.incentives)}</td>
                                        <td style={{ color: 'var(--error)' }}>{peso(r.sss)}</td>
                                        <td style={{ color: 'var(--error)' }}>{peso(r.philhealth)}</td>
                                        <td style={{ color: 'var(--error)' }}>{peso(r.pagibig)}</td>
                                        <td style={{ color: 'var(--error)' }}>{peso(r.cashAdvanceDeduction)}</td>
                                        <td>{peso(r.cashAdvanceBalance)}</td>
                                        <td style={{ color: 'var(--error)' }}>{peso(r.loans)}</td>
                                        <td style={{ color: 'var(--error)' }}>{peso(r.tax)}</td>
                                        <td style={{ fontWeight: 700, color: r.totalSalary >= 0 ? 'var(--success)' : 'var(--error)' }}>
                                            {peso(r.totalSalary)}
                                        </td>
                                        <td className="no-print">
                                            <button
                                                className="btn btn-outline"
                                                style={{ fontSize: '0.7rem', minHeight: 28, padding: '2px 8px' }}
                                                onClick={() => openAdjEditor(r.id)}
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ fontWeight: 700 }}>
                                    <td colSpan="4" style={{ textAlign: 'right' }}>Totals:</td>
                                    <td>{peso(payrollData.reduce((s, r) => s + r.salary, 0))}</td>
                                    <td>{payrollData.reduce((s, r) => s + parseFloat(r.otHours), 0).toFixed(2)}</td>
                                    <td>{peso(payrollData.reduce((s, r) => s + r.otPay, 0))}</td>
                                    <td>{peso(payrollData.reduce((s, r) => s + r.nightDiff, 0))}</td>
                                    <td>{peso(payrollData.reduce((s, r) => s + r.incentives, 0))}</td>
                                    <td>{peso(payrollData.reduce((s, r) => s + r.sss, 0))}</td>
                                    <td>{peso(payrollData.reduce((s, r) => s + r.philhealth, 0))}</td>
                                    <td>{peso(payrollData.reduce((s, r) => s + r.pagibig, 0))}</td>
                                    <td>{peso(payrollData.reduce((s, r) => s + r.cashAdvanceDeduction, 0))}</td>
                                    <td></td>
                                    <td>{peso(payrollData.reduce((s, r) => s + r.loans, 0))}</td>
                                    <td>{peso(payrollData.reduce((s, r) => s + r.tax, 0))}</td>
                                    <td style={{ color: 'var(--success)' }}>
                                        {peso(payrollData.reduce((s, r) => s + r.totalSalary, 0))}
                                    </td>
                                    <td className="no-print"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </>
            )}

            {!payrollData && !loading && (
                <p className="admin-empty">Select a month and click Generate Payroll.</p>
            )}

            {/* Adjustment Editor Modal */}
            {editingWorkerId && (
                <div className="admin-modal-overlay" onClick={() => setEditingWorkerId(null)}>
                    <div className="admin-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="admin-modal__header">
                            <h2 style={{ fontSize: '1rem' }}>
                                Adjustments — {workers.find(w => w.id === editingWorkerId)?.name}
                            </h2>
                            <button className="admin-modal__close" onClick={() => setEditingWorkerId(null)}>&times;</button>
                        </div>
                        <div className="admin-modal__form" style={{ padding: 'var(--sp-4)' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--sp-4)' }}>
                                {monthLabel} — Enter amounts manually
                            </p>
                            {[
                                { key: 'sss', label: 'SSS' },
                                { key: 'philhealth', label: 'PhilHealth' },
                                { key: 'pagibig', label: 'Pag-IBIG' },
                                { key: 'incentives', label: 'Incentives' },
                                { key: 'night_differential', label: 'Night Differential' },
                                { key: 'cash_advance_deduction', label: 'Cash Advance Deduction' },
                                { key: 'cash_advance_balance', label: 'CA Remaining Balance' },
                                { key: 'loans', label: 'Loans' },
                                { key: 'tax', label: 'Tax' },
                            ].map(({ key, label }) => (
                                <div className="admin-field" key={key} style={{ marginBottom: 'var(--sp-2)' }}>
                                    <label style={{ fontSize: '0.8rem' }}>{label}</label>
                                    <input
                                        type="number"
                                        value={editForm[key]}
                                        onChange={e => setEditForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
                                        min="0"
                                        step="0.01"
                                        style={{ fontSize: '0.85rem' }}
                                    />
                                </div>
                            ))}
                            <div className="admin-modal__actions" style={{ marginTop: 'var(--sp-4)' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setEditingWorkerId(null)}>Cancel</button>
                                <button className="btn btn-primary" onClick={saveAdjustment} disabled={savingAdj}>
                                    {savingAdj ? 'Saving…' : 'Save Adjustments'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
