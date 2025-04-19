// Get references to HTML elements
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const loadingIndicator = document.getElementById('loading-indicator');

// --- Configuration ---
const USE_PERFORMANCE_MODE = true; // Set to true for client-side, false for server-side (requires different logic)
const SEND_PROOF_TO_SERVER = true; // Send image proof if potential cheating detected?
const SERVER_ENDPOINT_PROOF = '/api/attention/flag'; // Example endpoint for sending proof

let isProcessing = false; // Flag to prevent concurrent processing runs
let lastSentTime = 0; // Timestamp of the last sent proof image
const COOLDOWN_PERIOD_MS = 10000; // 10 seconds cooldown between sending proofs

// --- Configuration (Additions) ---
const YAW_THRESHOLD_DEGREES = 30; // How many degrees left/right is "looking away"
const PITCH_THRESHOLD_DEGREES = 20; // How many degrees up/down is "looking away"
const LOOKING_AWAY_DURATION_MS = 2000; // Must look away for 2 seconds to trigger

// --- State Variables (Additions) ---
let lookingAwayStartTime = 0; // Timestamp when looking away began
let isCurrentlyLookingAway = false; // Flag: Is the user looking away right now?

// --- MediaPipe Face Mesh Setup ---

function onResults(results) {
	// Hide loading indicator once results start coming in
	if (loadingIndicator.style.display !== 'none') {
		loadingIndicator.style.display = 'none';
	}

	// Basic drawing (optional, useful for debugging)
	canvasCtx.save();
	canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
	// Flip the canvas horizontally to match the flipped video
	canvasCtx.translate(canvasElement.width, 0);
	canvasCtx.scale(-1, 1);
	// Draw the video frame onto the canvas
	canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

	if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
		// --- Core Logic Placeholder ---
		// We only process the first detected face
		const landmarks = results.multiFaceLandmarks[0];

		// Draw landmarks (optional)
		// drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {color: '#C0C0C070', lineWidth: 1});
		// drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, {color: '#FF3030'});
		// drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYEBROW, {color: '#FF3030'});
		// drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, {color: '#30FF30'});
		// drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYEBROW, {color: '#30FF30'});
		// drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, {color: '#E0E0E0'});
		// drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, {color: '#E0E0E0'});

		// TODO: Implement Head Pose / Attention Logic
		// 1. Estimate head rotation (yaw, pitch, roll) from landmarks.
		//    (This requires some 3D geometry calculations or using a helper library).
		//    Key landmarks for pose: nose tip, chin, forehead center, ear points.
		// 2. Define thresholds for "looking away" (e.g., yaw > 30 degrees, pitch < -20 degrees).
		// 3. Check if the "looking away" condition persists for a duration (e.g., > 2 seconds).

		const isLookingAway = checkAttention(landmarks); // Placeholder function

		if (isLookingAway) {
			console.log("Potential looking away event detected!");
			// --- Proof Sending Logic ---
			const now = Date.now();
			if (SEND_PROOF_TO_SERVER && (now - lastSentTime > COOLDOWN_PERIOD_MS)) {
				console.log("Cooldown passed, sending proof...");
				captureAndSendProof(results.image, "looking_away"); // Send the *original* image data
				lastSentTime = now;
			} else if (SEND_PROOF_TO_SERVER) {
				console.log("Cooldown active, skipping proof send.");
			}
		}

	} else {
		// No face detected - could also be a condition to monitor
		console.log("No face detected.");
	}

	canvasCtx.restore(); // Restore canvas context state
}

// --- Placeholder Functions (To Be Implemented) ---

function checkAttention(landmarks) {
	// !! IMPORTANT TODO: Replace this with actual head pose calculation !!
	// Example: Calculate yaw angle based on relative positions of nose, chin, ear landmarks.
	// This is a simplified placeholder just checking if a specific landmark (nose tip) is far left/right
	const noseTip = landmarks[1]; // Index 1 is often the nose tip landmark
	const faceWidthApproximation = 0.3; // Rough estimate relative to normalized coords

	if (noseTip.x < (0.5 - faceWidthApproximation / 2) || noseTip.x > (0.5 + faceWidthApproximation / 2)) {
		// Need to add duration check here as well
		// For now, just return true if nose is significantly off-center
		return true;
	}
	return false;
}

async function captureAndSendProof(imageSource, reason) {
	console.log(`Capturing proof for reason: ${reason}`);
	// Create a temporary canvas to draw the original image (not flipped)
	const tempCanvas = document.createElement('canvas');
	tempCanvas.width = imageSource.width;
	tempCanvas.height = imageSource.height;
	const tempCtx = tempCanvas.getContext('2d');
	tempCtx.drawImage(imageSource, 0, 0);

	// Get image data (use Blob for efficiency if possible)
	tempCanvas.toBlob(async (blob) => {
		if (!blob) {
			console.error("Failed to create blob from canvas");
			return;
		}

		const formData = new FormData();
		formData.append('image', blob, 'proof.jpg');
		formData.append('timestamp', new Date().toISOString());
		formData.append('reason', reason);
		formData.append('userId', 'USER_ID_PLACEHOLDER'); // Replace with actual user identifier

		try {
			console.log("Sending proof to server...");
			const response = await fetch(SERVER_ENDPOINT_PROOF, {
				method: 'POST',
				body: formData,
				// Add headers if needed (e.g., Authorization)
				// headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
			});

			if (response.ok) {
				console.log("Proof sent successfully.");
			} else {
				console.error("Failed to send proof:", response.status, await response.text());
			}
		} catch (error) {
			console.error("Error sending proof:", error);
		}
	}, 'image/jpeg', 0.8); // Adjust quality (0.8 = 80%)
}


// --- Initialization ---

if (USE_PERFORMANCE_MODE) {
	const faceMesh = new FaceMesh({
		locateFile: (file) => {
			// Point to the location of the WASM files
			return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
		}
	});

	faceMesh.setOptions({
		maxNumFaces: 1,             // Process only one face
		refineLandmarks: true,      // Get more detailed landmarks for eyes/lips/iris - IMPORTANT for pose
		minDetectionConfidence: 0.5,
		minTrackingConfidence: 0.5
	});

	faceMesh.onResults(onResults);

	// Use Camera utils to handle webcam input
	const camera = new Camera(videoElement, {
		onFrame: async () => {
			// Only process if the previous frame is done
			if (!isProcessing) {
				isProcessing = true;
				await faceMesh.send({ image: videoElement });
				isProcessing = false;
			}
		},
		width: 640,
		height: 480
	});

	camera.start()
		.then(() => {
			console.log("Camera started successfully.");
			// Loading indicator might still be visible until the first result arrives
		})
		.catch(err => {
			console.error("Failed to start camera:", err);
			loadingIndicator.textContent = "Error starting camera. Please grant permission.";
			loadingIndicator.style.color = 'red';
		});

} else {
	// TODO: Implement logic for 'Compatibility Mode' (sending 1 image/sec to server)
	loadingIndicator.textContent = "Compatibility Mode not yet implemented.";
	console.warn("Compatibility Mode (server-side processing) logic needs to be added.");
	// 1. Setup getUserMedia
	// 2. Setup setInterval to capture frame
	// 3. Send frame to existing server endpoint
}
