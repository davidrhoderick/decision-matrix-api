import luciaMiddleware from "@/lib/middleware";
import Elysia, { error, t } from "elysia";
import { userTable } from "@/lib/users-sessions";
import lucia from "@/lib/auth";
import { Argon2id } from "oslo/password";
import { Session, generateId } from "lucia";
import db from "@/lib/db";
import { eq } from "drizzle-orm";

const tokenType = "Bearer" as const;

type AuthResponse = { tokenType: string; session: Session; username: string };

const authentication = new Elysia()
  .derive(luciaMiddleware)
  .model({
    "auth.body": t.Object({
      username: t.String({
        minLength: 3,
        maxLength: 31,
        pattern: "[a-z0-9_-]+",
      }),
      password: t.String({ minLength: 6, maxLength: 255 }),
    }),
    "auth.response": t.Object({
      tokenType: t.String(),
      session: t.Object({
        id: t.String(),
        userId: t.String(),
        fresh: t.Boolean(),
        expiresAt: t.Date(),
      }),
      username: t.String(),
    }),
  })
  .post(
    "/signup",
    async ({
      body: { password: rawPassword, username },
    }): Promise<AuthResponse> => {
      const password = await new Argon2id().hash(rawPassword);
      const id = generateId(15);

      await db.insert(userTable).values({ username, id, password });

      const session = await lucia.createSession(id, {});

      return { tokenType, session, username };
    },
    {
      body: "auth.body",
      response: "auth.response",
      detail: { tags: ["Auth"] },
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

      return { tokenType, session, username };
    },
    {
      body: "auth.body",
      response: "auth.response",
      detail: { tags: ["Auth"] },
    }
  )
  .post(
    "/signout",
    async ({ headers: { authorization } }) => {
      const sessionId = lucia.readBearerToken(authorization ?? "");
      if (sessionId) {
        await lucia.invalidateSession(sessionId);
      }
    },
    { detail: { tags: ["Auth"] } }
  );

export default authentication;
