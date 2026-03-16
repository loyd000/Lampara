/**
 * OpenCV.js Face Detector — fast Haar-cascade face detection for real-time loops.
 *
 * Usage:
 *   import { loadOpenCV, detectFace, drawDetection, cleanup } from './opencv-face-detector';
 *   await loadOpenCV();          // call once at startup
 *   const rect = detectFace(videoElement);  // returns { x, y, w, h } or null
 *   drawDetection(canvasElement, videoElement, rect);
 *   cleanup();                   // release resources when done
 */

const OPENCV_CDN = 'https://docs.opencv.org/4.10.0/opencv.js';
const CASCADE_URL = '/models/haarcascade_frontalface_default.xml';

let cv = null;
let classifier = null;
let loadPromise = null;

/* ------------------------------------------------------------------ */
/*  Load OpenCV.js + Haar cascade (idempotent, safe to call multiple  */
/*  times — will only load once)                                      */
/* ------------------------------------------------------------------ */
export function loadOpenCV() {
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
        // If cv is already on window (e.g. loaded by another component)
        if (window.cv && window.cv.CascadeClassifier) {
            cv = window.cv;
            return initClassifier().then(resolve).catch(reject);
        }

        const script = document.createElement('script');
        script.src = OPENCV_CDN;
        script.async = true;

        script.onload = () => {
            // opencv.js sets up a Module-style loader; cv() returns a promise
            const cvLoader = window.cv;
            if (typeof cvLoader === 'function') {
                cvLoader().then((instance) => {
                    cv = instance;
                    window.cv = cv;           // cache for other consumers
                    initClassifier().then(resolve).catch(reject);
                });
            } else {
                // Older builds expose cv directly
                cv = window.cv;
                initClassifier().then(resolve).catch(reject);
            }
        };

        script.onerror = () => {
            loadPromise = null;
            reject(new Error('Failed to load OpenCV.js from CDN'));
        };

        document.head.appendChild(script);
    });

    return loadPromise;
}

/* ------------------------------------------------------------------ */
/*  Internal: download cascade XML and create the classifier          */
/* ------------------------------------------------------------------ */
async function initClassifier() {
    if (classifier) return;

    const response = await fetch(CASCADE_URL);
    if (!response.ok) throw new Error('Failed to fetch Haar cascade XML');
    const buf = await response.arrayBuffer();
    const data = new Uint8Array(buf);

    // Write the XML into OpenCV's virtual filesystem
    cv.FS_createDataFile('/', 'haarcascade_frontalface_default.xml', data, true, false, false);

    classifier = new cv.CascadeClassifier();
    const ok = classifier.load('haarcascade_frontalface_default.xml');
    if (!ok) throw new Error('Failed to load Haar cascade into OpenCV');
}

/* ------------------------------------------------------------------ */
/*  Detect a single face in a <video> element.                        */
/*  Returns { x, y, w, h } of the largest face, or null.             */
/* ------------------------------------------------------------------ */
export function detectFace(videoElement) {
    if (!cv || !classifier || !videoElement || videoElement.readyState < 2) return null;

    let src = null;
    let gray = null;
    let faces = null;

    try {
        src = new cv.Mat(videoElement.videoHeight, videoElement.videoWidth, cv.CV_8UC4);
        const cap = new cv.VideoCapture(videoElement);
        cap.read(src);

        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.equalizeHist(gray, gray);

        faces = new cv.RectVector();
        classifier.detectMultiScale(
            gray,
            faces,
            1.1,    // scaleFactor
            4,      // minNeighbors  (higher = fewer false positives)
            0,      // flags
            new cv.Size(80, 80),   // minSize — ignore very small faces
            new cv.Size(0, 0),     // maxSize — no limit
        );

        if (faces.size() === 0) return null;

        // Pick the largest face
        let best = null;
        for (let i = 0; i < faces.size(); i++) {
            const r = faces.get(i);
            if (!best || r.width * r.height > best.w * best.h) {
                best = { x: r.x, y: r.y, w: r.width, h: r.height };
            }
        }
        return best;
    } catch {
        return null;
    } finally {
        src?.delete();
        gray?.delete();
        faces?.delete();
    }
}

/* ------------------------------------------------------------------ */
/*  Draw a detection rectangle on a canvas overlay                    */
/* ------------------------------------------------------------------ */
export function drawDetection(canvasElement, videoElement, rect) {
    if (!canvasElement || !videoElement) return;

    const vw = videoElement.videoWidth;
    const vh = videoElement.videoHeight;
    canvasElement.width = vw;
    canvasElement.height = vh;

    const ctx = canvasElement.getContext('2d');
    ctx.clearRect(0, 0, vw, vh);

    if (!rect) return;

    ctx.strokeStyle = '#4ade80';     // green
    ctx.lineWidth = 3;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    // Small label
    ctx.fillStyle = 'rgba(74, 222, 128, 0.15)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/* ------------------------------------------------------------------ */
/*  Check if OpenCV is ready                                          */
/* ------------------------------------------------------------------ */
export function isOpenCVReady() {
    return cv !== null && classifier !== null;
}

/* ------------------------------------------------------------------ */
/*  Cleanup (optional — call when unmounting the whole attendance app) */
/* ------------------------------------------------------------------ */
export function cleanup() {
    if (classifier) { classifier.delete(); classifier = null; }
}
