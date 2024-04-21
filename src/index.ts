import { Elysia } from "elysia";

import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";

import authentication from "@/plugins/authentication";
import matrix from "@/plugins/matrix";

const app = new Elysia()
  .use(
    cors({
      allowedHeaders: ["Authorization", "content-type"],
      origin: process.env.FRONTEND_DOMAIN,
      credentials: true,
    })
  )
  .use(
    swagger({
      documentation: {
        tags: [
          {
            name: "Auth",
            description: "Authentication endpoints",
          },
          { name: "Matrix", description: "Endpoints for decision matrices" },
        ],
      },
    })
  )
  .use(authentication)
  .use(matrix)
  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
