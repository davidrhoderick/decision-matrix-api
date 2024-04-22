import luciaMiddleware from "@/lib/middleware";
import Elysia, { InternalServerError, error, t } from "elysia";
import lucia, { emailVerificationTable, userTable } from "@/lib/auth";
import { Argon2id } from "oslo/password";
import { generateId } from "lucia";
import db from "@/lib/db";
import { eq } from "drizzle-orm";
import { isWithinExpirationDate } from "oslo";
import { Resend } from "resend";
import emailVerificationToken from "@/lib/auth/email-vertification-token";

const tokenType = "Bearer" as const;

const resend = new Resend(process.env.RESEND_API_KEY);

const authentication = new Elysia()
  .derive(luciaMiddleware)
  .model({
    "signup.body": t.Object({
      email: t.String({ format: "email", default: "dummy@example.com" }),
      username: t.String({
        minLength: 3,
        maxLength: 31,
        pattern: "[a-z0-9_-]+",
        default: "dummy",
      }),
      password: t.String({ minLength: 6, maxLength: 255 }),
    }),
    "login.body": t.Object({
      username: t.String({
        minLength: 3,
        maxLength: 31,
        pattern: "[a-z0-9_-]+",
        default: "dummy",
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
    async ({ body: { password: rawPassword, username, email } }) => {
      const password = await new Argon2id().hash(rawPassword);
      const id = generateId(15);

      const [user] = await db
        .insert(userTable)
        .values({ username, id, password, email })
        .returning();

      await emailVerificationToken(user);

      return { success: true };
    },
    {
      body: "signup.body",
      detail: { tags: ["Auth"] },
    }
  )
  .get(
    "/confirm-email/:id",
    async ({ params: { id }, set }) => {
      await db.transaction(async (tx) => {
        const [token] = await db
          .select()
          .from(emailVerificationTable)
          .where(eq(emailVerificationTable.id, id));

        if (token) {
          await db
            .delete(emailVerificationTable)
            .where(eq(emailVerificationTable.id, token.id));
        }

        if (!token || !isWithinExpirationDate(new Date(token.expiresAt))) {
          return (set.redirect = `${process.env.FRONTEND_URL}/email-confirmation-expired`);
        }

        const [user] = await db
          .select()
          .from(userTable)
          .where(eq(userTable.id, token.userId));

        if (!user || user.email !== token.email) {
          throw error(400, { message: "Problem confirming email" });
        }

        await lucia.invalidateUserSessions(user.id);
        await db
          .update(userTable)
          .set({
            emailVerified: true,
          })
          .where(eq(userTable.id, user.id));

        return (set.redirect = `${process.env.FRONTEND_URL}/login`);
      });
    },
    {
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
        throw error(400, { message: "Invalid username or password" });
      }

      const validPassword = await new Argon2id().verify(
        existingUser.password,
        password
      );

      if (!validPassword) {
        throw error(400, { message: "Invalid username or password" });
      }

      if (!existingUser.emailVerified) {
        throw error(400, { message: "Email not verified" });
      }

      const session = await lucia.createSession(existingUser.id, {});

      return { tokenType, session, username };
    },
    {
      body: "login.body",
      response: "auth.response",
      detail: { tags: ["Auth"] },
    }
  )
  .post(
    "/resend-confirmation-email",
    async ({ body: { password, username }, set }) => {
      const [existingUser] = await db
        .select()
        .from(userTable)
        .where(eq(userTable.username, username));

      if (!existingUser) {
        throw error(400, { message: "Invalid username or password" });
      }

      const validPassword = await new Argon2id().verify(
        existingUser.password,
        password
      );

      if (!validPassword) {
        throw error(400, { message: "Invalid username or password" });
      }

      if (existingUser.emailVerified) {
        throw error(400, { message: "Email already verified" });
      }

      await emailVerificationToken(existingUser);

      return { success: true };
    },
    {
      body: "login.body",
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
