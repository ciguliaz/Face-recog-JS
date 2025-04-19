import { SERVER_ENDPOINT_PROOF } from './config.js';

/**
 * Captures the current imageSource and sends it to the server as proof.
 * @param {HTMLVideoElement|HTMLCanvasElement|ImageBitmap} imageSource - The source image.
 * @param {string} reason - The reason for sending the proof.
 * @param {string} userId - The identifier for the user.
 */
export async function captureAndSendProof(imageSource, reason, userId) {
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
        console.error(">>> DEBUG: Error drawing imageSource to temporary canvas:", drawError);
        return; // Cannot proceed if drawing fails
    }


    // Get image data as Blob
    tempCanvas.toBlob(async (blob) => {
        if (!blob) {
            console.error(">>> DEBUG: Failed to create blob from canvas");
            return;
        }

        const formData = new FormData();
        formData.append('image', blob, 'proof.jpg');
        formData.append('timestamp', new Date().toISOString());
        formData.append('reason', reason);
        formData.append('userId', userId); // Use the passed userId

        try {
            console.log(">>> DEBUG: Sending proof to server...");
            const response = await fetch(SERVER_ENDPOINT_PROOF, {
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