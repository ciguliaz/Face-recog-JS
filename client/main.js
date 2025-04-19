// --- Import Configuration ---
import * as Config from './config.js';

// --- Import Functions ---
import { checkAttentionAndGaze, checkMultiFace, resetViolationState } from './detection.js';
import { captureAndSendProof } from './serverUtils.js';

// --- Get DOM Elements ---
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const loadingIndicator = document.getElementById('loading-indicator');

// --- Global State (Main Scope) ---
let isProcessing = false;       // Prevent overlapping processing frames
let lastSentTime = 0;           // Timestamp of last proof sent (for cooldown)
let faceMesh;                   // MediaPipe FaceMesh instance
let camera;                     // MediaPipe Camera instance

// --- MediaPipe onResults Callback ---
function onResults(results) {
    // Hide loading indicator once results start coming in
    if (loadingIndicator.style.display !== 'none') {
        console.log(">>> DEBUG: First results received from MediaPipe.");
        loadingIndicator.style.display = 'none';
    }

    // Safety check
    if (!results || !results.image) {
        console.warn(">>> DEBUG: onResults called with invalid results object or missing image.");
        resetViolationState(); // Reset detection state if results are bad
        return;
    }

    // Basic canvas drawing setup
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.translate(canvasElement.width, 0); // Flip horizontally
    canvasCtx.scale(-1, 1);
    try {
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    } catch (drawError) {
        console.error(">>> DEBUG: Error drawing results image to canvas:", drawError);
        canvasCtx.restore();
        resetViolationState();
        return;
    }

    const now = Date.now();
    let violationReason = null;
    let triggerProof = false;
    const faceCount = results.multiFaceLandmarks ? results.multiFaceLandmarks.length : 0;

    // --- Run Detection Checks ---
    if (Config.ENABLE_MULTI_FACE_CHECK) {
        violationReason = checkMultiFace(faceCount, Config.MAX_FACES_ALLOWED);
        if (violationReason) {
            triggerProof = true; // Multi-face triggers immediately (or add duration in checkMultiFace)
             // Draw all faces if multiple detected (optional)
             if (faceCount > 0) {
                for (const landmarks of results.multiFaceLandmarks) {
                    try {
                        drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, {color: '#FF0000'});
                    } catch(e){ console.error("Draw error", e); }
                }
            }
        }
    }

    // If no multi-face violation, check single face (if exactly one face)
    if (!violationReason && faceCount === 1) {
         const landmarks = results.multiFaceLandmarks[0];
         violationReason = checkAttentionAndGaze(landmarks); // Returns reason if duration met
         if (violationReason) {
             triggerProof = true;
         }
         // Optional: Draw single face landmarks for debugging
         try {
             drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {color: '#C0C0C070', lineWidth: 1});
             drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, {color: '#E0E0E0'});
             if (Config.ENABLE_GAZE_CHECK) {
                 drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_IRIS, {color: '#30FF30'});
                 drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_IRIS, {color: '#FF3030'});
             }
         } catch (drawError) {
             console.error(">>> DEBUG: Error drawing single face landmarks:", drawError);
         }

    } else if (!violationReason && faceCount === 0) {
         // No faces detected (and not a multi-face violation)
         resetViolationState(); // Reset head/gaze state
         if(Math.random() < 0.05) { console.log(">>> DEBUG: No face detected."); }
         // Optional: Implement checkNoFaceDuration() here if needed
    } else if (!violationReason) {
        // Face count is > 1, but multi-face check might be disabled or didn't trigger
        resetViolationState();
        if(Math.random() < 0.05) { console.log(`>>> DEBUG: Incorrect number of faces detected (${faceCount}), but no multi-face violation triggered.`); }
    }


    // --- Send Proof if Triggered ---
    if (triggerProof && violationReason) {
        if (Config.SEND_PROOF_TO_SERVER && (now - lastSentTime > Config.COOLDOWN_PERIOD_MS)) {
             console.log(`>>> DEBUG: Cooldown passed, sending proof for reason: ${violationReason}`);
             // Pass required arguments to the imported function
             captureAndSendProof(results.image, violationReason, Config.USER_ID);
             lastSentTime = now;
        } else if (Config.SEND_PROOF_TO_SERVER) {
             // console.log(">>> DEBUG: Cooldown active, skipping proof send.");
        }
    }

    canvasCtx.restore(); // Restore canvas context
}


// --- Initialization Function ---
async function initializeApp() {
    if (Config.USE_PERFORMANCE_MODE) {
        console.log(">>> DEBUG: Initializing Performance Mode...");
        try {
            // Check dependencies (MediaPipe classes are global)
            if (typeof FaceMesh === 'undefined' || typeof Camera === 'undefined') {
                 const missing = typeof FaceMesh === 'undefined' ? 'FaceMesh' : 'Camera';
                 console.error(`>>> DEBUG: ${missing} class is not available. Check MediaPipe script loading in index.html.`);
                 loadingIndicator.textContent = `Error: ${missing} library not loaded.`;
                 return;
            }

            faceMesh = new FaceMesh({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`});
            console.log(">>> DEBUG: FaceMesh instance created.");

            faceMesh.setOptions({
                maxNumFaces: Config.MAX_NUM_FACES_MEDIAPIPE,
                refineLandmarks: true, // Required for gaze detection
                minDetectionConfidence: Config.MEDIAPIPE_CONFIDENCE,
                minTrackingConfidence: Config.MEDIAPIPE_CONFIDENCE
            });
            console.log(">>> DEBUG: FaceMesh options set:", faceMesh.options);

            faceMesh.onResults(onResults);
            console.log(">>> DEBUG: FaceMesh onResults callback set.");

            console.log(">>> DEBUG: Setting up camera...");
            camera = new Camera(videoElement, {
                onFrame: async () => {
                    if (!isProcessing && videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or more
                        isProcessing = true;
                        try {
                            await faceMesh.send({image: videoElement});
                        } catch (error) {
                             console.error(">>> DEBUG: Error sending frame to FaceMesh:", error);
                             resetViolationState(); // Reset state on processing error
                        } finally {
                            isProcessing = false;
                        }
                    } else if (videoElement.readyState < 2 && Math.random() < 0.05) {
                         console.log('>>> DEBUG: Video not ready. State:', videoElement.readyState);
                    }
                },
                width: 640,
                height: 480
            });

            console.log(">>> DEBUG: Starting camera...");
            await camera.start();
            console.log(">>> DEBUG: Camera started. Video dimensions:", videoElement.videoWidth, "x", videoElement.videoHeight);

        } catch (error) {
            console.error(">>> DEBUG: Initialization failed:", error);
            loadingIndicator.textContent = `Error: ${error.message}. Check console & permissions.`;
            resetViolationState();
        }

    } else {
        // --- Compatibility Mode ---
        loadingIndicator.textContent = "Compatibility Mode not implemented.";
        console.warn("Compatibility Mode logic needs to be added.");
        // TODO: Implement server-side stream logic here if needed
    }
}

// --- Start the application ---
initializeApp();
