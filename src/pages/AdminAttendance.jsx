import { useState, useEffect, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { supabase } from '../lib/supabase.js';

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

const MODEL_URL = '/models';

/* ============================================================
   Attendance Tab — top-level, loads models once
   ============================================================ */
export default function AttendanceTab() {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [modelError, setModelError] = useState('');
    const [subTab, setSubTab] = useState('workers'); // workers | logs | dtr

    useEffect(() => {
        async function load() {
            try {
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                setModelsLoaded(true);
            } catch (err) {
                setModelError('Could not load face-api models: ' + err.message);
            }
        }
        if (!faceapi.nets.ssdMobilenetv1.isLoaded) load();
        else setModelsLoaded(true);
    }, []);

    return (
        <div>
            <div className="admin-tabs" style={{ marginBottom: 'var(--sp-5)' }}>
                {['workers', 'logs', 'dtr'].map((t) => (
                    <button
                        key={t}
                        className={`admin-tab ${subTab === t ? 'active' : ''}`}
                        onClick={() => setSubTab(t)}
                    >
                        {t === 'workers' ? 'Workers' : t === 'logs' ? 'Attendance Logs' : 'DTR'}
                    </button>
                ))}
            </div>

            {modelError && <p className="admin-error" style={{ marginBottom: 'var(--sp-4)' }}>{modelError}</p>}

            {!modelsLoaded && !modelError && (
                <div className="admin-loading-inline">
                    <div className="spinner" />
                </div>
            )}

            {modelsLoaded && (
                <>
                    {subTab === 'workers' && <WorkersTab />}
                    {subTab === 'logs' && <LogsTab />}
                    {subTab === 'dtr' && <DTRTab />}
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

    const load = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('workers')
            .select('id, name, employee_id, position, email, status, created_at')
            .order('created_at', { ascending: false });
        setWorkers(data || []);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleApprove = async (id) => {
        setActionLoading(id + '_approve');
        await supabase.from('workers').update({ status: 'active' }).eq('id', id);
        setActionLoading(null);
        load();
    };

    const handleReject = async (id, name) => {
        if (!window.confirm(`Reject "${name}"'s registration?`)) return;
        setActionLoading(id + '_reject');
        await supabase.from('workers').update({ status: 'rejected' }).eq('id', id);
        setActionLoading(null);
        load();
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Remove worker "${name}" and all their attendance records?`)) return;
        await supabase.from('attendance_logs').delete().eq('worker_id', id);
        await supabase.from('workers').delete().eq('id', id);
        load();
    };

    const pending = workers.filter(w => w.status === 'pending');
    const active = workers.filter(w => w.status === 'active');
    const rejected = workers.filter(w => w.status === 'rejected');

    return (
        <div>
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
                            const initials = w.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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
                        const initials = w.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                        return (
                            <div key={w.id} className="admin-worker-card">
                                <div className="admin-worker-card__avatar">{initials}</div>
                                <div className="admin-worker-card__info">
                                    <h3>{w.name}</h3>
                                    <p>ID: {w.employee_id} {w.position ? `· ${w.position}` : ''}</p>
                                </div>
                                <div className="admin-worker-card__actions">
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
    const [form, setForm] = useState({ name: '', employee_id: '', position: '', email: '', password: '' });
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
        detectionRef.current = setInterval(async () => {
            const video = videoRef.current;
            if (!video || video.readyState < 2) return;
            const det = await faceapi
                .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!canvasRef.current || !video) return;
            const displaySize = { width: video.videoWidth, height: video.videoHeight };
            faceapi.matchDimensions(canvasRef.current, displaySize);
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

            if (det) {
                const resized = faceapi.resizeResults(det, displaySize);
                faceapi.draw.drawDetections(canvasRef.current, [resized]);
                setCaptureStatus('Face detected — click Capture');
                setCaptureStatusType('ok');
            } else {
                setCaptureStatus('No face detected. Adjust your position.');
                setCaptureStatusType('warn');
            }
        }, 500);
    };

    const capture = async () => {
        const video = videoRef.current;
        if (!video) return;
        setCaptureStatus('Processing…');
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
        supabase.from('workers').select('id, name').order('name').then(({ data }) => setWorkers(data || []));
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
        supabase.from('workers').select('id, name, employee_id, position').order('name').then(({ data }) => {
            setWorkers(data || []);
        });
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
            if (timeIn && timeOut) {
                const diff = (new Date(timeOut.logged_at) - new Date(timeIn.logged_at)) / (1000 * 60 * 60);
                hours = Math.max(0, diff).toFixed(2);
            }

            const dateObj = new Date(dateStr + 'T12:00:00');
            const dayName = dateObj.toLocaleDateString('en-PH', { weekday: 'short' });
            rows.push({ date: dateStr, day: d, dayName, timeIn, timeOut, hours });
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
                                const headers = ['Day', 'Date', 'Time In', 'Time Out', 'Hours', 'Remarks'];
                                const fmtT = (ts) => ts ? new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                                const rows = dtrData.map(r => {
                                    const isSunday = r.dayName === 'Sun';
                                    const isAbsent = !r.timeIn && !isSunday;
                                    return [
                                        r.dayName, r.day,
                                        fmtT(r.timeIn?.logged_at), fmtT(r.timeOut?.logged_at),
                                        r.hours ?? '',
                                        isSunday ? 'Rest Day' : isAbsent ? 'Absent' : r.timeIn && !r.timeOut ? 'No time-out' : '',
                                    ];
                                });
                                rows.push(['', '', '', 'Total Hours', totalHours, '']);
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
                        <h3>Daily Time Record</h3>
                        <p style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '1rem', marginBottom: 4 }}>{workerInfo.name}</p>
                        <p>{workerInfo.position || 'Worker'} &nbsp;·&nbsp; ID: {workerInfo.employee_id}</p>
                        <p style={{ marginTop: 4 }}>{monthLabel}</p>
                    </div>

                    <div className="dtr-summary">
                        <div className="dtr-summary-card">
                            <div className="dtr-summary-card__value">{presentDays}</div>
                            <div className="dtr-summary-card__label">Days Present</div>
                        </div>
                        <div className="dtr-summary-card">
                            <div className="dtr-summary-card__value">{absentDays}</div>
                            <div className="dtr-summary-card__label">Days Absent</div>
                        </div>
                        <div className="dtr-summary-card">
                            <div className="dtr-summary-card__value">{totalHours}</div>
                            <div className="dtr-summary-card__label">Total Hours</div>
                        </div>
                    </div>

                    <div className="dtr-table-wrap">
                        <table className="dtr-table">
                            <thead>
                                <tr>
                                    <th>Day</th>
                                    <th>Date</th>
                                    <th>Time In</th>
                                    <th>Time Out</th>
                                    <th>Hours</th>
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
                                            <td>{row.dayName}</td>
                                            <td>{row.day}</td>
                                            <td>{fmtTime(row.timeIn?.logged_at)}</td>
                                            <td>{fmtTime(row.timeOut?.logged_at)}</td>
                                            <td>{row.hours ?? '—'}</td>
                                            <td style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                {isSunday ? 'Rest Day' : isAbsent ? 'Absent' : row.timeIn && !row.timeOut ? 'No time-out' : ''}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'right', paddingRight: 'var(--sp-3)' }}>Total Hours Worked:</td>
                                    <td>{totalHours}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div style={{ marginTop: 'var(--sp-8)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-8)', padding: 'var(--sp-6) 0' }}>
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-2)', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Employee Signature</p>
                        </div>
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-2)', textAlign: 'center' }}>
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
