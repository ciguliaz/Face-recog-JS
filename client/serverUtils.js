import { API_TEST_PIPE_FACEVERIFY, API_TEST_PIPE_SENDPROOF, SERVER_ENDPOINT_PROOF } from './config.js'; // Import both endpoints

/**
 * Sends an image to the server for initial identity verification.
 * @param {Blob} imageBlob - The image data as a Blob.
 * @param {string} userId - The identifier for the user.
 * @returns {Promise<object>} Promise resolving with the server's JSON response (e.g., { verified: boolean, message?: string }).
 */
export async function sendVerificationImage(imageBlob, userId) {
	console.log(`>>> DEBUG: Sending image for verification. User: ${userId}`);

	const formData = new FormData();
	formData.append('image', imageBlob, 'verify_face.jpg');
	formData.append('userId', userId);

	try {
		const response = await fetch(API_TEST_PIPE_FACEVERIFY, { // Use the verification endpoint
			// TODO: change this to use the actual endpoint for actual verification
			method: 'POST',
			body: formData,
			// Add headers like Authorization if required by your backend
		});

		console.log(response)

		if (!response.ok) {
			// Attempt to parse error message from server if possible
			let errorMsg = `Server responded with status: ${response.status}`;
			try {
				const errorData = await response.json();
				errorMsg = errorData.message || errorMsg;
			} catch (e) { /* Ignore parsing error */ }
			console.error(">>> DEBUG: Verification request failed:", errorMsg);
			// Return a standard error format
			return { verified: false, message: errorMsg };
		}

		const data = await response.json();
		console.log(">>> DEBUG: Verification response received:", data);
		return data; // Expecting { verified: boolean, message?: string }

	} catch (error) {
		console.error(">>> DEBUG: Network or other error sending verification image:", error);
		return { verified: false, message: `Network error: ${error.message}` }; // Return standard error format
	}
}

/**
 * Captures the current imageSource and sends it to the server as proof for violations.
 * (Keep the existing captureAndSendProof function exactly as it was)
 * @param {HTMLVideoElement|HTMLCanvasElement|ImageBitmap} imageSource - The source image.
 * @param {string} reason - The reason for sending the proof.
 * @param {string} userId - The identifier for the user.
 */
export async function captureAndSendProof(imageSource, reason, userId) {
	// ... (Keep the previous implementation of this function) ...
	console.log(`>>> DEBUG: Capturing proof for reason: ${reason}, User: ${userId}`);

	// Ensure imageSource is valid and has dimensions
	if (!imageSource || !imageSource.width || !imageSource.height || imageSource.width === 0 || imageSource.height === 0) {
		console.error(">>> DEBUG: Invalid imageSource provided for captureAndSendProof.");
		return;
	}

	// Use a temporary canvas to draw the image (ensures correct orientation if needed)
	const tempCanvas = document.createElement('canvas');
	tempCanvas.width = imageSource.width;
	tempCanvas.height = imageSource.height;
	const tempCtx = tempCanvas.getContext('2d');
	try {
		tempCtx.drawImage(imageSource, 0, 0);
	} catch (drawError) {
		console.error(">>> DEBUG: Error drawing imageSource to temporary canvas for proof:", drawError);
		return; // Cannot proceed if drawing fails
	}

	// Get image data as Blob
	tempCanvas.toBlob(async (blob) => {
		if (!blob) {
			console.error(">>> DEBUG: Failed to create blob from canvas for proof");
			return;
		}
		const formData = new FormData();
		formData.append('image', blob, 'proof.jpg');
		formData.append('timestamp', new Date().toISOString());
		formData.append('reason', reason);
		formData.append('userId', userId); // Use the passed userId

		try {
			console.log(">>> DEBUG: Sending proof to server...");
			const response = await fetch(API_TEST_PIPE_SENDPROOF, { // Use the proof endpoint
				method: 'POST',
				body: formData,
				// Add headers like Authorization if required by your backend
				// headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
			});
			if (response.ok) {
				console.log(">>> DEBUG: Proof sent successfully.");
			} else {
				console.error(">>> DEBUG: Failed to send proof:", response.status, await response.text());
			}
		} catch (error) {
			console.error(">>> DEBUG: Network or other error sending proof:", error);
		}
	}, 'image/jpeg', 0.8); // Adjust quality (0.8 = 80%)
}