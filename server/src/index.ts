import { Elysia } from "elysia";
import cors from "@elysiajs/cors";

import testRoutes from "./routes/test";

const app = new Elysia().use(cors())
	.get("/", () => "Hello Elysia")
	.use(testRoutes)
	.listen(6969)
console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
