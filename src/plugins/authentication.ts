import luciaMiddleware from "@/lib/middleware";
import Elysia, { InternalServerError, error, t } from "elysia";
import lucia, { emailVertificationTable, userTable } from "@/lib/auth";
import { Argon2id } from "oslo/password";
import { generateId } from "lucia";
import db from "@/lib/db";
import { eq } from "drizzle-orm";
import { TimeSpan, createDate, isWithinExpirationDate } from "oslo";
import { Resend } from "resend";

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

      await db.insert(userTable).values({ username, id, password, email });

      await db
        .delete(emailVertificationTable)
        .where(eq(emailVertificationTable.userId, id));
      const tokenId = generateId(40);
      const [{ id: emailVerificationToken }] = await db
        .insert(emailVertificationTable)
        .values({
          id: tokenId,
          email,
          userId: id,
          expiresAt: createDate(new TimeSpan(2, "h")).toString(),
        })
        .returning({ id: emailVertificationTable.id });

      try {
        await resend.emails.send({
          from: "decision-matrix@afabl.com",
          to: email,
          subject: "Confirm your email address",
          html: `<h1>Confirm your email address</h1>
          <p>Please confirm your email address by clicking on the link below:</p>
          
          <a href="${process.env.BACKEND_URL}/confirm-email/${emailVerificationToken}">${process.env.BACKEND_URL}/confirm-email/${emailVerificationToken}</a>
          
          <p>Then you will be able to start using the application</p>
          
          <p>~Dave</p>`,
        });
        return { success: true };
      } catch (error) {
        console.error(error);
        throw new InternalServerError("Unable to send confirmation email");
      }
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
          .from(emailVertificationTable)
          .where(eq(emailVertificationTable.id, id));

        if (token) {
          await db
            .delete(emailVertificationTable)
            .where(eq(emailVertificationTable.id, token.id));
        }

        if (!token || !isWithinExpirationDate(new Date(token.expiresAt))) {
          throw error(400, { message: "Confirm email token expired" });
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
