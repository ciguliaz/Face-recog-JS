// Configuration Settings

// --- Feature Flags ---
export const USE_PERFORMANCE_MODE = true; // Client-side processing
export const SEND_PROOF_TO_SERVER = true; // Send image proof on violation?
export const ENABLE_MULTI_FACE_CHECK = true;
export const ENABLE_HEAD_POSE_CHECK = true; // Separate flag if needed
export const ENABLE_GAZE_CHECK = true;
export const DRAW_DEBUG_MESH = true; // Set to true to show mesh, false to hide

// --- Server ---
export const SERVER_ENDPOINT_PROOF = '/api/attention/flag'; // Your backend endpoint
export const SERVER_ENDPOINT_VERIFY = '/api/verify_identity'; // For initial identity check
export const USER_ID = 'ciguliaz'; // Hardcoded for now, get dynamically if possible
// export const TEST5050 = 'https://mock-ai-service-1ec530c9630e.herokuapp.com/test/api/mediapipe/face_verify'; //mock api response for testing, 50% success rate
export const API_TEST_PIPE_FACEVERIFY = 'http://localhost:6969/test/mediapipe/face_verify'; //mock api response for testing, 50% success rate
export const API_TEST_PIPE_SENDPROOF = 'http://localhost:6969/test/mediapipe/send_proof'; //mock api response for testing, 50% success rate


// --- Thresholds & Timings ---
export const YAW_THRESHOLD_DEGREES = 30;    // Head turn left/right
export const PITCH_THRESHOLD_DEGREES = 20;  // Head tilt up/down
export const GAZE_THRESHOLD_RATIO = 0.45;   // Iris position (0.0-1.0, triggers outside [ratio, 1-ratio])
export const LOOKING_AWAY_DURATION_MS = 1000; // Violation must persist (milliseconds)
export const COOLDOWN_PERIOD_MS = 10000;   // Min time between sending proofs (milliseconds)
export const MAX_FACES_ALLOWED = 1;       // Max faces before triggering multi-face violation

// --- MediaPipe Settings ---
export const MEDIAPIPE_CONFIDENCE = 0.5; // minDetectionConfidence & minTrackingConfidence
export const MAX_NUM_FACES_MEDIAPIPE = ENABLE_MULTI_FACE_CHECK ? 5 : 1; // How many faces MP should look for

// --- Pose Estimation Tuning ---
// Adjust these multipliers based on testing if yaw/pitch estimates seem off
export const YAW_ESTIMATION_MULTIPLIER = 90;
export const PITCH_ESTIMATION_MULTIPLIER = 90;