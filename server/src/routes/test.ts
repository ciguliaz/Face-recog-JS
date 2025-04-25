import { Elysia, t } from 'elysia';

const testRoutes = new Elysia()
	.group('/test', (app) =>
		app
			.get("/", () => "Hello test routes")
			//-------------------------------------------------------------------------------------
			.post('/mediapipe/face_verify', async ({ set }: { set: any }) => {
				console.log(">>> Received request on /test/mediapipe/face_verify");
				if (Math.random() < 0.5) {
					console.log(">>> Responding with 200 OK");
					return { verified: true, message: "Identity verified successfully." };
				} else {
					console.log(">>> Responding with 418 I'm a teapot");
					set.status = 418; // I'm a teapot
					return { verified: false, message: "Verification failed (simulated 50% error)." };
				}
			}, {
				body: t.Object({
					image: t.File(), //not sure if it work
					userId: t.String(),
				})
			})
			//-------------------------------------------------------------------------------------
			.post('/mediapipe/send_proof', async ({ set }: { set: any }) => {
				console.log(">>> Received request on /test/mediapipe/send_proof");
				if (Math.random() < 0.9) {
					console.log(">>> Responding with 200 OK");
					return { verified: true, message: "Proof saved successfully." };
				} else {
					console.log(">>> Responding with 418 I'm a teapot");
					set.status = 418; // I'm a teapot
					return { verified: false, message: "Proof saved failed (simulated 10% error)." };
				}
			}, {
				body: t.Object({
					image: t.File(), //not sure if it work
					userId: t.String(),
					timestamp: t.String(),
					reason: t.String(),
				})
			})
	)



export default testRoutes;