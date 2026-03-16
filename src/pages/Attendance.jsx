import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { supabase } from '../lib/supabase.js';
import { Link } from 'react-router-dom';
import './Attendance.css';

const MODEL_URL = '/models';

/* ============================================================
   Root — loads models, manages screen state
   ============================================================ */
export default function Attendance() {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [modelError, setModelError] = useState('');
    const [screen, setScreen] = useState('welcome'); // welcome | camera | confirm | success
    const [matchedWorker, setMatchedWorker] = useState(null);
    const [lastAction, setLastAction] = useState(null);
    const [successData, setSuccessData] = useState(null);
    const [liveTime, setLiveTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setLiveTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        async function loadModels() {
            try {
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                setModelsLoaded(true);
            } catch (err) {
                setModelError('Failed to load face recognition models. ' + err.message);
            }
        }
        loadModels();
    }, []);

    const handleFaceMatch = useCallback(async (worker) => {
        const { data } = await supabase
            .from('attendance_logs')
            .select('action, logged_at')
            .eq('worker_id', worker.id)
            .order('logged_at', { ascending: false })
            .limit(1);
        setMatchedWorker(worker);
        setLastAction(data?.[0] || null);
        setScreen('confirm');
    }, []);

    const handleRecord = async (action) => {
        const { error } = await supabase.from('attendance_logs').insert({
            worker_id: matchedWorker.id,
            action,
            logged_at: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
        });
        if (!error) {
            setSuccessData({ worker: matchedWorker, action, time: new Date() });
            setScreen('success');
        }
    };

    const reset = () => {
        setScreen('welcome');
        setMatchedWorker(null);
        setLastAction(null);
        setSuccessData(null);
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
                {!modelsLoaded && !modelError && (
                    <div className="att-loading">
                        <div className="att-loading__spinner" />
                        <p>Loading face recognition models…</p>
                    </div>
                )}

                {modelError && (
                    <div className="att-error-msg">{modelError}</div>
                )}

                {modelsLoaded && screen === 'welcome' && (
                    <WelcomeScreen
                        time={formatTime(liveTime)}
                        date={formatDate(liveTime)}
                        onStart={() => setScreen('camera')}
                    />
                )}

                {modelsLoaded && screen === 'camera' && (
                    <CameraScreen
                        onMatch={handleFaceMatch}
                        onCancel={reset}
                    />
                )}

                {screen === 'confirm' && matchedWorker && (
                    <ConfirmScreen
                        worker={matchedWorker}
                        lastAction={lastAction}
                        onRecord={handleRecord}
                        onRetry={() => setScreen('camera')}
                    />
                )}

                {screen === 'success' && successData && (
                    <SuccessScreen
                        data={successData}
                        onDone={reset}
                        formatTime={formatTime}
                    />
                )}
            </div>
        </div>
    );
}

/* ============================================================
   Welcome Screen
   ============================================================ */
function WelcomeScreen({ time, date, onStart }) {
    return (
        <div className="att-welcome">
            <div className="att-welcome__time">{time}</div>
            <div className="att-welcome__date">{date}</div>
            <div className="att-welcome__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
            </div>
            <h2>Worker Time Tracker</h2>
            <p>Look into the camera to identify yourself and record your attendance.</p>
            <button className="att-btn-primary" onClick={onStart}>
                Start Face Scan
            </button>
        </div>
    );
}

/* ============================================================
   Camera Screen — detects & matches face
   ============================================================ */
function CameraScreen({ onMatch, onCancel }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const intervalRef = useRef(null);
    const [status, setStatus] = useState('scanning'); // scanning | detected | matching | nomatch | error
    const [statusMsg, setStatusMsg] = useState('Position your face in the frame');
    const [workers, setWorkers] = useState([]);
    const matchAttemptedRef = useRef(false);

    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                const { data } = await supabase.from('workers').select('id, name, employee_id, position, face_descriptor');
                if (mounted) setWorkers(data || []);
            } catch { /* ignored */ }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
                });
                if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current.play();
                        startDetection();
                    };
                }
            } catch (err) {
                if (mounted) {
                    setStatus('error');
                    setStatusMsg('Camera access denied. Please allow camera permission.');
                }
            }
        }

        init();

        return () => {
            mounted = false;
            clearInterval(intervalRef.current);
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    const startDetection = () => {
        intervalRef.current = setInterval(async () => {
            if (!videoRef.current || matchAttemptedRef.current) return;
            const video = videoRef.current;
            if (video.readyState < 2) return;

            const detection = await faceapi
                .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                setStatus('scanning');
                setStatusMsg('Position your face in the frame');
                drawFrame(null);
                return;
            }

            setStatus('detected');
            setStatusMsg('Face detected — matching…');
            drawFrame(detection);

            // Match against workers
            const currentWorkers = workers.length
                ? workers
                : (await supabase.from('workers').select('id, name, employee_id, position, face_descriptor').then(r => r.data || []));

            if (currentWorkers.length === 0) {
                setStatus('nomatch');
                setStatusMsg('No registered workers found. Ask admin to register you first.');
                return;
            }

            const labeledDescriptors = currentWorkers
                .filter(w => w.face_descriptor && w.face_descriptor.length === 128)
                .map(w => new faceapi.LabeledFaceDescriptors(
                    w.id,
                    [new Float32Array(w.face_descriptor)]
                ));

            if (labeledDescriptors.length === 0) {
                setStatus('nomatch');
                setStatusMsg('No face data registered yet. Ask admin to register you.');
                return;
            }

            const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55);
            const best = matcher.findBestMatch(detection.descriptor);

            if (best.label === 'unknown') {
                setStatus('nomatch');
                setStatusMsg('Face not recognized. Try again or contact admin.');
                setTimeout(() => {
                    matchAttemptedRef.current = false;
                    setStatus('scanning');
                    setStatusMsg('Position your face in the frame');
                }, 2500);
                return;
            }

            matchAttemptedRef.current = true;
            clearInterval(intervalRef.current);
            streamRef.current?.getTracks().forEach(t => t.stop());

            const matched = currentWorkers.find(w => w.id === best.label);
            setStatus('matched');
            setStatusMsg(`Matched: ${matched.name}`);
            setTimeout(() => onMatch(matched), 600);
        }, 500);
    };

    const drawFrame = (detection) => {
        if (!canvasRef.current || !videoRef.current) return;
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detection) {
            const resized = faceapi.resizeResults(detection, displaySize);
            faceapi.draw.drawDetections(canvas, [resized]);
        }
    };

    const statusClass = {
        scanning: 'att-camera__status--scanning',
        detected: 'att-camera__status--detected',
        matching: 'att-camera__status--detected',
        matched: 'att-camera__status--matched',
        nomatch: 'att-camera__status--error',
        error: 'att-camera__status--error',
    }[status] || 'att-camera__status--scanning';

    return (
        <div className="att-camera">
            <div className="att-camera__label">Face Recognition</div>
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
                    <span className="att-dots">
                        <span /><span /><span />
                    </span>
                )}
            </p>
            <button className="att-btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
    );
}

/* ============================================================
   Confirm Screen — worker matched, choose action
   ============================================================ */
function ConfirmScreen({ worker, lastAction, onRecord, onRetry }) {
    const [submitting, setSubmitting] = useState(false);
    const initials = worker.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const lastActionText = lastAction
        ? `Last: ${lastAction.action === 'time_in' ? 'Clocked In' : 'Clocked Out'} at ${new Date(lastAction.logged_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}`
        : 'No previous record today';

    const handle = async (action) => {
        setSubmitting(true);
        await onRecord(action);
        setSubmitting(false);
    };

    return (
        <div className="att-confirm">
            <div className="att-confirm__avatar">{initials}</div>
            <div className="att-confirm__name">{worker.name}</div>
            <div className="att-confirm__role">{worker.position || 'Worker'}</div>
            <div className="att-confirm__id">ID: {worker.employee_id}</div>
            <div className="att-confirm__last">{lastActionText}</div>

            <div className="att-confirm__actions">
                <button
                    className="att-btn-timein"
                    onClick={() => handle('time_in')}
                    disabled={submitting}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0 0V8m0 4h4m-4 0H8M12 21a9 9 0 100-18 9 9 0 000 18z" />
                    </svg>
                    Time In
                    <span className="att-btn-sub">Clock In</span>
                </button>
                <button
                    className="att-btn-timeout"
                    onClick={() => handle('time_out')}
                    disabled={submitting}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m0 0l3-3m-3 3l3 3M12 21a9 9 0 100-18 9 9 0 000 18z" />
                    </svg>
                    Time Out
                    <span className="att-btn-sub">Clock Out</span>
                </button>
            </div>

            <button className="att-btn-secondary" onClick={onRetry}>Not me? Scan again</button>
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
