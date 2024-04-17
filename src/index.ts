import { Elysia, error, t } from "elysia";

import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";

import { Argon2id } from "oslo/password";
import { generateId } from "lucia";

import db from "@/lib/db";
import { userTable } from "@/lib/users-sessions";
import lucia from "@/lib/auth";
import luciaMiddleware from "@/lib/middleware";

import { eq } from "drizzle-orm";

const tokenType = 'Bearer' as const

const app = new Elysia()
  .use(
    cors({
      allowedHeaders: ["Authorization", "content-type"],
      origin: process.env.FRONTEND_URL,
      credentials: true,
    })
  )
  .use(swagger())
  .derive(luciaMiddleware)
  .model({
    auth: t.Object({
      username: t.String({
        minLength: 3,
        maxLength: 31,
        pattern: "[a-z0-9_-]+",
      }),
      password: t.String({ minLength: 6, maxLength: 255 }),
    }),
  })
  .post(
    "/signup",
    async ({ body: { password: rawPassword, username }, set }) => {
      const password = await new Argon2id().hash(rawPassword);
      const id = generateId(15);

      await db.insert(userTable).values({ username, id, password });

      const session = await lucia.createSession(id, {});

      return { tokenType, session };
    },
    {
      body: "auth",
    }
  )
  .post(
    "/login",
    async ({ body: { password, username } }) => {
      const [existingUser] = await db
        .select()
        .from(userTable)
        .where(eq(userTable.username, username));

      if (!existingUser) {
        throw error(400, "Invalid username or password");
      }

      const validPassword = await new Argon2id().verify(
        existingUser.password,
        password
      );

      if (!validPassword) {
        throw error(400, "Invalid username or password");
      }

      const session = await lucia.createSession(existingUser.id, {});

      return { tokenType, session };
    },
    {
      body: "auth",
    }
  )
  .post("/signout", async ({ headers: { authorization } }) => {
    const sessionId = lucia.readBearerToken(authorization ?? "");
    if (sessionId) {
      await lucia.invalidateSession(sessionId);
    }
  })
  .get("/", async ({ headers: { authorization } }) => {
    const sessionId = lucia.readBearerToken(authorization ?? "");

    if (!sessionId) {
      return { status: "not logged in" };
    }

    const result = await lucia.validateSession(sessionId);

    if (result.session) {
      return { status: "logged in" };
    } else {
      return { status: "not logged in" };
    }
  })
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
