import {
	YAW_THRESHOLD_DEGREES, PITCH_THRESHOLD_DEGREES, GAZE_THRESHOLD_RATIO,
	LOOKING_AWAY_DURATION_MS, ENABLE_GAZE_CHECK, ENABLE_HEAD_POSE_CHECK,
	YAW_ESTIMATION_MULTIPLIER, PITCH_ESTIMATION_MULTIPLIER
} from './config.js';

// --- State Variables specific to detection logic ---
let lookingAwayStartTime = 0;
let isCurrentlyLookingAway = false; // Tracks combined head/gaze violation state
let multiFaceDetectedTime = 0; // Example if duration needed for multi-face
let isCurrentlyMultiFace = false; // Example if duration needed for multi-face

/**
* Analyzes face landmarks for head pose and gaze direction violations.
* @param {Array} landmarks - Array of landmark objects from MediaPipe Face Mesh.
* @returns {string|null} Reason for violation if duration met, otherwise null.
*/
export function checkAttentionAndGaze(landmarks) {
	let headPoseViolation = false;
	let gazeViolation = false;
	let reason = null;

	// Basic visibility check for essential landmarks
	const noseTip = landmarks[1];
	const leftEyeInner = landmarks[133];
	const rightEyeInner = landmarks[362];
	const chin = landmarks[152];
	const foreheadCenter = landmarks[10];

	if (!noseTip || !leftEyeInner || !rightEyeInner || !chin || !foreheadCenter ||
		(leftEyeInner.visibility != null && leftEyeInner.visibility < 0.5) ||
		(rightEyeInner.visibility != null && rightEyeInner.visibility < 0.5) ||
		(noseTip.visibility != null && noseTip.visibility < 0.5) ||
		(chin.visibility != null && chin.visibility < 0.5)) {
		if (isCurrentlyLookingAway) { isCurrentlyLookingAway = false; lookingAwayStartTime = 0; }
		return null; // Not enough data
	}

	// --- 1. Estimate Head Pose ---
	if (ENABLE_HEAD_POSE_CHECK) {
		const eyeMidPointX = (leftEyeInner.x + rightEyeInner.x) / 2;
		const eyeMidPointY = (leftEyeInner.y + rightEyeInner.y) / 2;
		const horizontalDiff = noseTip.x - eyeMidPointX;
		const eyeDistance = Math.abs(leftEyeInner.x - rightEyeInner.x);

		if (eyeDistance > 0.01) {
			const yawRatio = horizontalDiff / eyeDistance;
			const estimatedYaw = yawRatio * YAW_ESTIMATION_MULTIPLIER;
			if (Math.abs(estimatedYaw) > YAW_THRESHOLD_DEGREES) {
				headPoseViolation = true;
				reason = "head_yaw";
			}
		}

		const verticalDiff = noseTip.y - eyeMidPointY;
		const faceHeight = Math.abs(foreheadCenter.y - chin.y);
		if (faceHeight > 0.01) {
			const pitchRatio = verticalDiff / faceHeight;
			const estimatedPitch = pitchRatio * PITCH_ESTIMATION_MULTIPLIER;
			if (Math.abs(estimatedPitch) > PITCH_THRESHOLD_DEGREES) {
				headPoseViolation = true;
				reason = reason || "head_pitch"; // Keep yaw reason if already set
			}
		}
	}

	// --- 2. Estimate Gaze Direction ---
	const checkGazeRegardlessOfHeadPose = true; // Set to true to check gaze independently

	if (ENABLE_GAZE_CHECK && (!headPoseViolation || checkGazeRegardlessOfHeadPose)) {

		const leftIrisCenter = landmarks[473];
		const rightIrisCenter = landmarks[468];
		const leftEyeOuterCorner = landmarks[33];
		const leftEyeInnerCorner = landmarks[133];
		const rightEyeOuterCorner = landmarks[263];
		const rightEyeInnerCorner = landmarks[362];

		if (leftIrisCenter && leftEyeOuterCorner && leftEyeInnerCorner && rightIrisCenter && rightEyeOuterCorner && rightEyeInnerCorner &&
			leftIrisCenter.visibility > 0.5 && leftEyeOuterCorner.visibility > 0.5 && leftEyeInnerCorner.visibility > 0.5 &&
			rightIrisCenter.visibility > 0.5 && rightEyeOuterCorner.visibility > 0.5 && rightEyeInnerCorner.visibility > 0.5) {
			const leftEyeWidth = Math.abs(leftEyeOuterCorner.x - leftEyeInnerCorner.x);
			const rightEyeWidth = Math.abs(rightEyeOuterCorner.x - rightEyeInnerCorner.x);

			if (leftEyeWidth > 0.01 && rightEyeWidth > 0.01) {
				const leftIrisPosRelative = leftIrisCenter.x - Math.min(leftEyeOuterCorner.x, leftEyeInnerCorner.x);
				const rightIrisPosRelative = rightIrisCenter.x - Math.min(rightEyeOuterCorner.x, rightEyeInnerCorner.x);

				const leftIrisRatio = leftIrisPosRelative / leftEyeWidth;
				const rightIrisRatio = rightIrisPosRelative / rightEyeWidth;

				// Log only occasionally to avoid flooding the console
				if (Math.random() < 0.03) { // Log about 3% of the time
					console.log(`>>> Gaze Ratios: L=${leftIrisRatio.toFixed(3)}, R=${rightIrisRatio.toFixed(3)} | Thresholds: [${GAZE_THRESHOLD_RATIO.toFixed(3)}, ${(1.0 - GAZE_THRESHOLD_RATIO).toFixed(3)}]`);
				}

				if (leftIrisRatio < GAZE_THRESHOLD_RATIO || leftIrisRatio > (1.0 - GAZE_THRESHOLD_RATIO) ||
					rightIrisRatio < GAZE_THRESHOLD_RATIO || rightIrisRatio > (1.0 - GAZE_THRESHOLD_RATIO)) {
					gazeViolation = true;
					// --- START CHANGE: Modified Reason Assignment ---
					// Only set reason if head pose didn't already set one OR if we check gaze independently
					if (!reason || checkGazeRegardlessOfHeadPose) {
						reason = "gaze_direction";
					}
					// --- END CHANGE ---
					// Log when the condition is met
					// console.log(`>>> Gaze VIOLATION detected: L=${leftIrisRatio.toFixed(3)}, R=${rightIrisRatio.toFixed(3)}`);
				}
			}
		}
	}

	// --- 3. Check Duration for Combined Violations ---
	let triggerProof = false;
	const isViolationNow = headPoseViolation || gazeViolation; // Use the locally determined violations
	const now = Date.now();

	if (isViolationNow) {
		if (!isCurrentlyLookingAway) {
			isCurrentlyLookingAway = true;
			lookingAwayStartTime = now;
			// Use the 'reason' determined by head pose or gaze check
			console.log(`>>> DEBUG: Started violation: ${reason || 'unknown'}`); // Log the specific reason
		} else {
			const duration = now - lookingAwayStartTime;
			if (duration >= LOOKING_AWAY_DURATION_MS) {
				triggerProof = true; // Duration met, signal to send proof
			}
		}
	} else {
		if (isCurrentlyLookingAway) {
			console.log(">>> DEBUG: Stopped violation.");
			isCurrentlyLookingAway = false;
			lookingAwayStartTime = 0;
		}
	}

	// Return the reason ONLY if the duration threshold is also met
	// Use the 'reason' determined by head pose or gaze check in step 1 or 2
	return triggerProof ? reason : null;
}

/**
* Resets the internal state related to head/gaze violations.
* Call this when face is lost or invalid.
*/
export function resetViolationState() {
	if (isCurrentlyLookingAway) {
		console.log(">>> DEBUG: Resetting violation state.");
		isCurrentlyLookingAway = false;
		lookingAwayStartTime = 0;
	}
	// Reset multi-face state too if applicable
	if (isCurrentlyMultiFace) {
		isCurrentlyMultiFace = false;
		multiFaceDetectedTime = 0;
	}
}

/**
* Checks for multi-face violation (currently immediate, could add duration).
* @param {number} faceCount - Number of faces detected.
* @param {number} maxAllowed - Maximum faces allowed from config.
* @returns {string|null} "multiple_faces" if violation, else null.
*/
export function checkMultiFace(faceCount, maxAllowed) {
	if (faceCount > maxAllowed) {
		// Optional: Add duration logic here using isCurrentlyMultiFace and multiFaceDetectedTime
		// For now, trigger immediately
		console.warn(`>>> DEBUG: Multiple faces detected! Count: ${faceCount}`);
		return "multiple_faces";
	}
	// Optional: Reset multi-face duration state if needed
	return null;
}