// Get references to HTML elements
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const loadingIndicator = document.getElementById('loading-indicator');

// --- Configuration ---
const USE_PERFORMANCE_MODE = true;
const SEND_PROOF_TO_SERVER = true;
const SERVER_ENDPOINT_PROOF = '/api/attention/flag'; // Replace if needed
const YAW_THRESHOLD_DEGREES = 30;
const PITCH_THRESHOLD_DEGREES = 20;
const LOOKING_AWAY_DURATION_MS = 2000;
const COOLDOWN_PERIOD_MS = 10000;

// --- State Variables ---
let isProcessing = false;
let lastSentTime = 0;
let lookingAwayStartTime = 0;
let isCurrentlyLookingAway = false;
let faceMesh; // Declare faceMesh globally for access in error handling
let camera; // Declare camera globally

// --- MediaPipe Face Mesh Setup ---

function onResults(results) {
	// Hide loading indicator once results start coming in (even if no face)
	if (loadingIndicator.style.display !== 'none') {
		console.log(">>> DEBUG: First results received from MediaPipe.");
		loadingIndicator.style.display = 'none';
	}

	// Safety check for results object and image
	if (!results || !results.image) {
		console.warn(">>> DEBUG: onResults called with invalid results object or missing image.");
		return; // Don't proceed if results are bad
	}

	// Basic drawing (optional, useful for debugging)
	canvasCtx.save();
	canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
	canvasCtx.translate(canvasElement.width, 0);
	canvasCtx.scale(-1, 1);
	try {
		canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
	} catch (drawError) {
		console.error(">>> DEBUG: Error drawing results image to canvas:", drawError);
		canvasCtx.restore(); // Ensure context is restored even on error
		return;
	}


	// --- Core Logic ---
	if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
		// Only log periodically to avoid flooding console if detection is stable
		if (Math.random() < 0.1) {
			console.log(">>> DEBUG: Face detected! Landmark count:", results.multiFaceLandmarks[0].length);
		}
		const landmarks = results.multiFaceLandmarks[0];

		// Optional: Draw landmarks for visual confirmation
		try {
			drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, { color: '#C0C0C070', lineWidth: 1 });
			drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, { color: '#E0E0E0' });
		} catch (drawError) {
			console.error(">>> DEBUG: Error drawing landmarks:", drawError);
		}


		const triggerProof = checkAttention(landmarks);

		if (triggerProof) {
			console.log(">>> DEBUG: Attention check returned true (duration met)!");
			const now = Date.now();
			if (SEND_PROOF_TO_SERVER && (now - lastSentTime > COOLDOWN_PERIOD_MS)) {
				console.log(">>> DEBUG: Cooldown passed, sending proof...");
				captureAndSendProof(results.image, "looking_away");
				lastSentTime = now;
			} else if (SEND_PROOF_TO_SERVER) {
				// console.log(">>> DEBUG: Cooldown active, skipping proof send."); // Less frequent log
			}
		}

	} else {
		// No face detected
		if (isCurrentlyLookingAway) {
			console.log(">>> DEBUG: Face lost, resetting looking away state.");
			isCurrentlyLookingAway = false;
			lookingAwayStartTime = 0;
		}
		// Only log periodically to avoid flooding console
		if (Math.random() < 0.05) { // Log roughly every 20 frames
			console.log(">>> DEBUG: No face detected in this frame.");
		}
	}

	canvasCtx.restore();
}

// --- checkAttention function (keep the improved version from previous step) ---
function checkAttention(landmarks) {
	// ... (previous implementation with pose estimation and duration check) ...
	// Add more console logs inside this function if needed for threshold tuning
	const noseTip = landmarks[1];
	const leftEyeInner = landmarks[133];
	const rightEyeInner = landmarks[362];
	const chin = landmarks[152];
	const foreheadCenter = landmarks[10];

	// Enhanced Visibility Check: Check if landmark exists AND if visibility property exists before checking its value
	if (!noseTip || !leftEyeInner || !rightEyeInner || !chin || !foreheadCenter ||
		(leftEyeInner.visibility != null && leftEyeInner.visibility < 0.5) ||
		(rightEyeInner.visibility != null && rightEyeInner.visibility < 0.5) ||
		(noseTip.visibility != null && noseTip.visibility < 0.5) ||
		(chin.visibility != null && chin.visibility < 0.5)) {
		// console.log("Essential landmarks not clearly visible."); // Less frequent log
		if (isCurrentlyLookingAway) {
			isCurrentlyLookingAway = false;
			lookingAwayStartTime = 0;
		}
		return false;
	}


	const eyeMidPointX = (leftEyeInner.x + rightEyeInner.x) / 2;
	const eyeMidPointY = (leftEyeInner.y + rightEyeInner.y) / 2;
	const horizontalDiff = noseTip.x - eyeMidPointX;
	const eyeDistance = Math.abs(leftEyeInner.x - rightEyeInner.x);
	if (eyeDistance < 0.01) return false; // Avoid division by zero/tiny number
	const yawRatio = horizontalDiff / eyeDistance;
	const estimatedYaw = yawRatio * 90; // Tune this multiplier

	const verticalDiff = noseTip.y - eyeMidPointY;
	const faceHeight = Math.abs(foreheadCenter.y - chin.y);
	if (faceHeight < 0.01) return false; // Avoid division by zero/tiny number
	const pitchRatio = verticalDiff / faceHeight;
	const estimatedPitch = pitchRatio * 90; // Tune this multiplier

	const yawExceeded = Math.abs(estimatedYaw) > YAW_THRESHOLD_DEGREES;
	const pitchExceeded = Math.abs(estimatedPitch) > PITCH_THRESHOLD_DEGREES;

	let isLookingAwayNow = yawExceeded || pitchExceeded;

	// Optional: Log estimated angles for debugging
	// if (Math.random() < 0.1) { // Log periodically
	//     console.log(`Yaw: ${estimatedYaw.toFixed(1)}, Pitch: ${estimatedPitch.toFixed(1)}, Away: ${isLookingAwayNow}`);
	// }

	let triggerProof = false;
	const now = Date.now();

	if (isLookingAwayNow) {
		if (!isCurrentlyLookingAway) {
			isCurrentlyLookingAway = true;
			lookingAwayStartTime = now;
			// console.log("Started looking away");
		} else {
			const duration = now - lookingAwayStartTime;
			if (duration >= LOOKING_AWAY_DURATION_MS) {
				triggerProof = true;
			}
		}
	} else {
		if (isCurrentlyLookingAway) {
			// console.log("Stopped looking away");
			isCurrentlyLookingAway = false;
			lookingAwayStartTime = 0;
		}
	}

	return triggerProof;
}


// --- captureAndSendProof function (keep as before) ---
async function captureAndSendProof(imageSource, reason) {
	// ... (previous implementation) ...
	console.log(`>>> DEBUG: Capturing proof for reason: ${reason}`);
	const tempCanvas = document.createElement('canvas');
	// Ensure imageSource has valid dimensions
	if (!imageSource || !imageSource.width || !imageSource.height) {
		console.error(">>> DEBUG: Invalid imageSource for captureAndSendProof");
		return;
	}
	tempCanvas.width = imageSource.width;
	tempCanvas.height = imageSource.height;
	const tempCtx = tempCanvas.getContext('2d');
	tempCtx.drawImage(imageSource, 0, 0);

	tempCanvas.toBlob(async (blob) => {
		if (!blob) {
			console.error(">>> DEBUG: Failed to create blob from canvas");
			return;
		}
		const formData = new FormData();
		formData.append('image', blob, 'proof.jpg');
		formData.append('timestamp', new Date().toISOString());
		formData.append('reason', reason);
		formData.append('userId', 'ciguliaz'); // Using your login, replace if dynamic needed
		try {
			console.log(">>> DEBUG: Sending proof to server...");
			const response = await fetch(SERVER_ENDPOINT_PROOF, {
				method: 'POST',
				body: formData,
				// Add headers if needed (e.g., Authorization)
			});
			if (response.ok) {
				console.log(">>> DEBUG: Proof sent successfully.");
			} else {
				console.error(">>> DEBUG: Failed to send proof:", response.status, await response.text());
			}
		} catch (error) {
			console.error(">>> DEBUG: Error sending proof:", error);
		}
	}, 'image/jpeg', 0.8);
}


// --- Initialization ---
async function initializeApp() { // Wrap in async function for await
	if (USE_PERFORMANCE_MODE) {
		console.log(">>> DEBUG: Initializing Performance Mode...");
		try {
			// Check if FaceMesh is available
			if (typeof FaceMesh === 'undefined') {
				console.error(">>> DEBUG: FaceMesh class is not available. Check MediaPipe script loading in index.html.");
				loadingIndicator.textContent = "Error: FaceMesh library not loaded.";
				loadingIndicator.style.color = 'red';
				return; // Stop initialization
			}

			faceMesh = new FaceMesh({
				locateFile: (file) => {
					const url = `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
					console.log(`>>> DEBUG: Locating file: ${url}`); // Log file location attempts
					return url;
				}
			});
			console.log(">>> DEBUG: FaceMesh instance created.");

			faceMesh.setOptions({
				maxNumFaces: 1,
				refineLandmarks: true,
				minDetectionConfidence: 0.5, // Start with default, lower if needed
				minTrackingConfidence: 0.5
			});
			console.log(">>> DEBUG: FaceMesh options set:", faceMesh.options);

			faceMesh.onResults(onResults);
			console.log(">>> DEBUG: FaceMesh onResults callback set.");

			// Check if Camera is available
			if (typeof Camera === 'undefined') {
				console.error(">>> DEBUG: Camera class is not available. Check MediaPipe script loading in index.html.");
				loadingIndicator.textContent = "Error: Camera library not loaded.";
				loadingIndicator.style.color = 'red';
				return; // Stop initialization
			}

			console.log(">>> DEBUG: Setting up camera...");
			camera = new Camera(videoElement, {
				onFrame: async () => {
					// console.log('>>> DEBUG: Camera frame received.'); // Can be very noisy
					if (!isProcessing && videoElement.readyState >= videoElement.HAVE_CURRENT_DATA) { // More robust check (readyState >= 2 or 3)
						isProcessing = true;
						try {
							// console.log('>>> DEBUG: Sending frame to Face Mesh:', videoElement.currentTime);
							await faceMesh.send({ image: videoElement });
						} catch (error) {
							console.error(">>> DEBUG: Error sending frame to FaceMesh:", error);
							// Optionally stop processing if errors persist? Maybe reset faceMesh?
						} finally {
							isProcessing = false;
							// console.log('>>> DEBUG: ...Processing done');
						}
					} else if (videoElement.readyState < videoElement.HAVE_CURRENT_DATA) {
						// Only log periodically
						if (Math.random() < 0.05) {
							console.log('>>> DEBUG: Video not ready for processing yet. State:', videoElement.readyState);
						}
					} else {
						// console.log('>>> DEBUG: Still processing previous frame, skipping.'); // Less frequent log
					}
				},
				width: 640,
				height: 480
			});

			console.log(">>> DEBUG: Starting camera...");
			await camera.start(); // Use await here
			console.log(">>> DEBUG: Camera started successfully. Video dimensions:", videoElement.videoWidth, "x", videoElement.videoHeight);
			// Loading indicator will be hidden by onResults

		} catch (error) {
			console.error(">>> DEBUG: Initialization failed:", error);
			loadingIndicator.textContent = `Error: ${error.message}. Check console & permissions.`;
			loadingIndicator.style.color = 'red';
		}

	} else {
		loadingIndicator.textContent = "Compatibility Mode not yet implemented.";
		console.warn("Compatibility Mode logic needs to be added.");
	}
}

// --- Start the app ---
initializeApp();