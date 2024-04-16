import { Elysia, error, t } from "elysia";
import { Argon2id } from "oslo/password";

import { swagger } from "@elysiajs/swagger";
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
  .use(swagger())
  .derive(luciaMiddleware)
  .post(
    "/signup",
    async ({ body: { password: rawPassword, username } }) => {
      const password = await new Argon2id().hash(rawPassword);
      const id = generateId(15);

      await db.insert(userTable).values({ username, id, password });
    },
    {
      body: usernameWithPassword,
    }
  )
  .post(
    "/login",
    async ({ body: { password, username }, cookie: { auth_session } }) => {
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

      const {
        value,
        attributes: { httpOnly, secure, sameSite, path, maxAge },
      } = lucia.createSessionCookie(session.id);

      auth_session.value = value;
      auth_session.httpOnly = httpOnly;
      auth_session.secure = secure;
      auth_session.sameSite = sameSite;
      auth_session.path = path;
      auth_session.maxAge = maxAge;
    },
    {
      body: usernameWithPassword,
    }
  )
  .get("/", async ({ headers, cookie: { auth_session } }) => {
    const sessionId = lucia.readSessionCookie(headers.cookie ?? "");

    if (!sessionId) {
      return "No session";
    }

    const result = await lucia.validateSession(sessionId);

    if (result.session && result.session.fresh) {
      const {
        value,
        attributes: { httpOnly, secure, sameSite, path, maxAge },
      } = lucia.createSessionCookie(sessionId);

      auth_session.value = value;
      auth_session.httpOnly = httpOnly;
      auth_session.secure = secure;
      auth_session.sameSite = sameSite;
      auth_session.path = path;
      auth_session.maxAge = maxAge;
    }

    if (!result.session) {
      auth_session.value = lucia.createBlankSessionCookie().value;
    }

    if (result.session) {
      return "logged in";
    } else {
      return "not logged in";
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
