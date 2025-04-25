// --- Import Configuration ---
import * as Config from './config.js';

// --- Import Functions ---
import { checkAttentionAndGaze, checkMultiFace, resetViolationState } from './detection.js';
import { captureAndSendProof, sendVerificationImage } from './serverUtils.js'; // Import both server utils

// --- Get DOM Elements ---
// Verification UI
const verificationSection = document.getElementById('verification-section');
const verificationVideo = document.getElementById('verification-video');
const verifyButton = document.getElementById('verify-button');
const verificationStatus = document.getElementById('verification-status');
// Monitoring UI
const monitoringSection = document.getElementById('monitoring-section');
const videoElement = document.getElementById('input-video'); // For MediaPipe
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const loadingIndicator = document.getElementById('loading-indicator'); // For MediaPipe loading

// --- Global State ---
let isProcessing = false;       // Prevent overlapping MediaPipe frames
let lastSentTime = 0;           // Timestamp of last proof sent
let faceMesh;                   // MediaPipe FaceMesh instance
let monitoringCamera;           // MediaPipe Camera instance for monitoring
let verificationStream;         // MediaStream used for verification preview

// --- MediaPipe onResults Callback (for Monitoring) ---
function onResults(results) {
	// Hide MediaPipe loading indicator once results start coming in
	if (loadingIndicator.style.display !== 'none') {
		console.log(">>> DEBUG: First monitoring results received from MediaPipe.");
		loadingIndicator.style.display = 'none';
	}

	// Safety check
	if (!results || !results.image) {
		console.warn(">>> DEBUG: onResults (monitoring) called with invalid results.");
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
		console.error(">>> DEBUG: Error drawing monitoring results image:", drawError);
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
			if (Config.DRAW_DEBUG_MESH && faceCount > 0) { // Only draw if flag is true
				for (const landmarks of results.multiFaceLandmarks) {
					try {
						// Draw red outline for multiple faces if debugging is enabled
						drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, { color: '#FF0000' });
					} catch (e) { console.error("Draw error multi-face:", e); }
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
		if (Config.DRAW_DEBUG_MESH) { // Only draw if flag is true
			try { // Draw single face landmarks
				drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, { color: '#C0C0C070', lineWidth: 1 });
				drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, { color: '#E0E0E0' });
				if (Config.ENABLE_GAZE_CHECK) { // Keep gaze drawing dependent on its own flag too
					drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_IRIS, { color: '#30FF30' });
					drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_IRIS, { color: '#FF3030' });
				}
			} catch (drawError) {
				console.error(">>> DEBUG: Error drawing single face landmarks:", drawError);
			}
		}
	} else if (!violationReason && faceCount === 0) {
		// No faces detected (and not a multi-face violation)
		resetViolationState(); // Reset head/gaze state
		if (Math.random() < 0.05) { console.log(">>> DEBUG: No face detected during monitoring."); }
		// Optional: Implement checkNoFaceDuration() here if needed
	} else if (!violationReason) {
		// Face count is > 1, but multi-face check might be disabled or didn't trigger
		resetViolationState();
		if (Math.random() < 0.05) { console.log(`>>> DEBUG: Incorrect face count (${faceCount}) during monitoring.`); }
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
		}// else console.log(">>> DEBUG: Cooldown active...");
	}
	canvasCtx.restore(); // Restore canvas context
}


// --- Function to Start Continuous Monitoring (after verification) ---
async function startMonitoring() {
	console.log(">>> DEBUG: Verification successful. Starting continuous monitoring...");
	monitoringSection.classList.remove('hidden'); // Show monitoring UI
	loadingIndicator.style.display = 'block'; // Show MediaPipe loading indicator initially

	// Stop the verification video stream if it's still running
	if (verificationStream) {
		verificationStream.getTracks().forEach(track => track.stop());
		console.log(">>> DEBUG: Stopped verification video stream.");
	}

	try {
		// Check dependencies (MediaPipe classes are global)
		if (typeof FaceMesh === 'undefined' || typeof Camera === 'undefined') {
			const missing = typeof FaceMesh === 'undefined' ? 'FaceMesh' : 'Camera';
			throw new Error(`${missing} class is not available. Check MediaPipe script loading.`);
		}

		faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
		console.log(">>> DEBUG: FaceMesh instance created.");
		faceMesh.setOptions({
			maxNumFaces: Config.MAX_NUM_FACES_MEDIAPIPE,
			refineLandmarks: true, // Required for gaze
			minDetectionConfidence: Config.MEDIAPIPE_CONFIDENCE,
			minTrackingConfidence: Config.MEDIAPIPE_CONFIDENCE
		});
		console.log(">>> DEBUG: FaceMesh options set:", faceMesh.options);

		faceMesh.onResults(onResults);
		console.log(">>> DEBUG: FaceMesh onResults callback set.");

		// Use the specific video element for monitoring
		console.log(">>> DEBUG: Setting up camera...");
		monitoringCamera = new Camera(videoElement, {
			onFrame: async () => {
				if (!isProcessing && videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or more
					isProcessing = true;
					try {
						await faceMesh.send({ image: videoElement });
					} catch (error) {
						console.error(">>> DEBUG: Error sending frame to FaceMesh (monitoring):", error);
						resetViolationState();
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
		await monitoringCamera.start();
		console.log(">>> DEBUG: Monitoring camera started. Video dimensions:", videoElement.videoWidth, "x", videoElement.videoHeight);
		// Loading indicator will be hidden by the first onResults callback

	} catch (error) {
		console.error(">>> DEBUG: Failed to start monitoring:", error);
		loadingIndicator.textContent = `Error starting monitoring: ${error.message}`;
		loadingIndicator.style.color = 'red';
		// Optionally hide the whole monitoring section again or show a persistent error
		// monitoringSection.classList.add('hidden');
	}
}


// --- Function to Handle Verification Button Click ---
async function handleVerification() {
	verifyButton.disabled = true; // Prevent double-clicks
	verificationStatus.textContent = 'Status: Capturing image...';

	if (!verificationStream || !verificationVideo.srcObject) {
		verificationStatus.textContent = 'Status: Error - Camera stream not available.';
		verifyButton.disabled = false;
		return;
	}

	// Capture a frame from the verification video element
	const tempCanvas = document.createElement('canvas');
	// Use the actual video dimensions for capture quality
	tempCanvas.width = verificationVideo.videoWidth;
	tempCanvas.height = verificationVideo.videoHeight;
	const tempCtx = tempCanvas.getContext('2d');

	// Draw the *non-mirrored* frame
	tempCtx.save();
	tempCtx.scale(-1, 1); // Flip horizontally to undo the CSS mirror effect
	tempCtx.drawImage(verificationVideo, -tempCanvas.width, 0, tempCanvas.width, tempCanvas.height);
	tempCtx.restore();

	tempCanvas.toBlob(async (blob) => {
		if (!blob) {
			console.error(">>> DEBUG: Failed to create blob for verification");
			verificationStatus.textContent = 'Status: Error capturing image.';
			verifyButton.disabled = false;
			return;
		}

		verificationStatus.textContent = 'Status: Verifying identity with server...';
		const result = await sendVerificationImage(blob, Config.USER_ID);

		if (result && result.verified) {
			verificationStatus.textContent = 'Status: Verification Successful!';
			verificationSection.classList.add('hidden'); // Hide verification UI
			// Start the main monitoring process
			await startMonitoring();
		} else {
			const message = result.message || "Verification failed. Please ensure good lighting and try again.";
			verificationStatus.textContent = `Status: ${message}`;
			verificationStatus.style.color = 'red';
			verifyButton.disabled = false; // Re-enable button to allow retry
			// Keep the verification stream running for retry
		}

	}, 'image/jpeg', 0.9); // Use slightly higher quality for verification
}


// --- Function to Initialize Verification Camera ---
async function initializeVerificationCamera() {
	try {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			throw new Error("getUserMedia is not supported by this browser.");
		}

		verificationStream = await navigator.mediaDevices.getUserMedia({
			video: { width: 320, height: 240 }, // Request specific size for preview
			audio: false
		});

		verificationVideo.srcObject = verificationStream;
		verificationVideo.onloadedmetadata = () => {
			verificationStatus.textContent = 'Status: Camera ready. Click Verify.';
			verificationStatus.style.color = 'black';
			verifyButton.disabled = false; // Enable button now
		};

	} catch (error) {
		console.error(">>> DEBUG: Failed to get verification camera:", error);
		verificationStatus.textContent = `Status: Error accessing camera - ${error.message}`;
		verificationStatus.style.color = 'red';
		verifyButton.disabled = true;
	}
}


// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
	// Disable button initially until camera is ready
	verifyButton.disabled = true;
	verifyButton.addEventListener('click', handleVerification);

	// Start the verification camera setup
	initializeVerificationCamera();
});