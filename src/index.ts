import { Elysia, t } from "elysia";

import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";

import authentication from "@/plugins/authentication";
import matrices from "@/plugins/matrices";

const app = new Elysia()
  .use(
    cors({
      allowedHeaders: ["Authorization", "content-type"],
      origin: process.env.FRONTEND_URL,
      credentials: true,
    })
  )
  .use(swagger())
  .use(authentication)
  .use(matrices)
  .ws("/edit", {
    body: t.Object({
      message: t.String(),
    }),
    message(ws, message) {
      ws.send({ message, time: Date.now() });
    },
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
