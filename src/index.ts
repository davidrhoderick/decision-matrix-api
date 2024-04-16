import { Elysia, error, t } from "elysia";
import { Argon2id } from "oslo/password";

import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import luciaMiddleware from "./lib/middleware";
import { generateId } from "lucia";
import db from "./lib/db";
import { userTable } from "./lib/users-sessions";
import { eq } from "drizzle-orm";
import lucia from "./lib/auth";

const usernameWithPassword = t.Object({
  username: t.String({
    minLength: 3,
    maxLength: 31,
    pattern: "[a-z0-9_-]+",
  }),
  password: t.String({ minLength: 6, maxLength: 255 }),
});

const app = new Elysia()
  .use(
    cors({
      allowedHeaders: ["cookie", "Set-Cookie", "content-type"],
      origin: "localhost:5173",
      credentials: true,
    })
  )
  .use(swagger())
  .derive(luciaMiddleware)
  .post(
    "/signup",
    async ({ body: { password: rawPassword, username }, set }) => {
      const password = await new Argon2id().hash(rawPassword);
      const id = generateId(15);

      await db.insert(userTable).values({ username, id, password });

      const session = await lucia.createSession(id, {});

      set.headers["Set-Cookie"] = lucia
        .createSessionCookie(session.id)
        .serialize();
    },
    {
      body: usernameWithPassword,
    }
  )
  .post(
    "/login",
    async ({ body: { password, username }, set }) => {
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

      set.headers["Set-Cookie"] = lucia
        .createSessionCookie(session.id)
        .serialize();
    },
    {
      body: usernameWithPassword,
    }
  )
  .post("/signout", async ({ set, headers }) => {
    const sessionId = lucia.readSessionCookie(headers.cookie ?? "");
    if (sessionId) {
      await lucia.invalidateSession(sessionId);

      set.headers["Set-Cookie"] = lucia.createBlankSessionCookie().serialize();
    }
  })
  .get("/", async ({ headers, set }) => {
    const sessionId = lucia.readSessionCookie(headers.cookie ?? "");

    if (!sessionId) {
      return { status: "not logged in" };
    }

    const result = await lucia.validateSession(sessionId);

    if (result.session && result.session.fresh) {
      set.headers["Set-Cookie"] = lucia
        .createSessionCookie(sessionId)
        .serialize();
    }

    if (!result.session) {
      set.headers["Set-Cookie"] = lucia.createBlankSessionCookie().serialize();
    }

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
