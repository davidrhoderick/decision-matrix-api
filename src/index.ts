import { Elysia, error, t } from "elysia";

import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";

import { Argon2id } from "oslo/password";
import { Session, generateId } from "lucia";

import db from "@/lib/db";
import { userTable } from "@/lib/users-sessions";
import lucia from "@/lib/auth";
import luciaMiddleware from "@/lib/middleware";

import { and, eq } from "drizzle-orm";
import validateSession from "./lib/validate-session";
import { matrixTable } from "./lib/matrices";

const tokenType = "Bearer" as const;

type AuthResponse = { tokenType: string; session: Session };

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
    }),
    matrices: t.Array(
      t.Object({
        id: t.String(),
        name: t.String(),
      })
    ),
    matrix: t.Object({
      id: t.String(),
      name: t.String(),
      choices: t.Object({ list: t.Array(t.String()) }),
      factors: t.Object({ list: t.Array(t.String()) }),
      factorsChoices: t.Object({ matrix: t.Array(t.Array(t.Number())) }),
      userId: t.String(),
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

      return { tokenType, session };
    },
    {
      body: "auth.body",
      response: "auth.response",
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
      body: "auth.body",
      response: "auth.response",
    }
  )
  .post("/signout", async ({ headers: { authorization } }) => {
    const sessionId = lucia.readBearerToken(authorization ?? "");
    if (sessionId) {
      await lucia.invalidateSession(sessionId);
    }
  })
  .guard(
    {
      beforeHandle: async ({ headers: { authorization }, set }) => {
        if (!(await validateSession(authorization)).session) {
          return (set.status = "Unauthorized");
        }
      },
    },
    (app) =>
      app
        .resolve(async ({ headers: { authorization } }) =>
          validateSession(authorization)
        )
        .get(
          "/",
          async ({ session }) =>
            db
              .select({ id: matrixTable.id, name: matrixTable.name })
              .from(matrixTable)
              .where(eq(matrixTable.userId, (session as Session).userId)),
          {
            response: "matrices",
          }
        )
        .get(
          "/",
          async ({ session }) =>
            db
              .select({ id: matrixTable.id, name: matrixTable.name })
              .from(matrixTable)
              .where(eq(matrixTable.userId, (session as Session).userId)),
          {
            response: "matrices",
          }
        )
        .post(
          "/matrix",
          async ({ session }) => {
            const [matrix] = await db
              .insert(matrixTable)
              .values({
                id: generateId(15),
                userId: (session as Session).userId,
              })
              .returning();

            return matrix;
          },
          { response: "matrix" }
        )
        .get(
          "/matrix/:id",
          async ({ session, params: { id }, set }) => {
            const [matrix] = await db
              .select()
              .from(matrixTable)
              .where(
                and(
                  eq(matrixTable.userId, (session as Session).userId),
                  eq(matrixTable.id, id)
                )
              );

            if (!matrix) {
              return (set.status = "Not Found");
            }

            return matrix;
          },
          {
            response: {
              200: "matrix",
              400: t.String(),
            },
          }
        )
        .guard(
          {
            beforeHandle: async ({ session, params, set }) => {
              const [matrix] = await db
                .select()
                .from(matrixTable)
                .where(
                  and(
                    eq(matrixTable.userId, (session as Session).userId),
                    eq(matrixTable.id, (params as { id: string }).id)
                  )
                );

              if (!matrix) {
                return (set.status = "Not Found");
              }
            },
          },
          (app) =>
            app
              .put(
                "/matrix/:id",
                async ({ session, body, params: { id } }) => {
                  const [matrix] = await db
                    .update(matrixTable)
                    .set(body)
                    .where(
                      and(
                        eq(matrixTable.userId, (session as Session).userId),
                        eq(matrixTable.id, id)
                      )
                    )
                    .returning();

                  return matrix;
                },
                {
                  body: "matrix",
                  response: "matrix",
                }
              )
              .delete(
                "/matrix/:id",
                async ({ params: { id } }) => {
                  const [result] = await db
                    .delete(matrixTable)
                    .where(eq(matrixTable.id, id))
                    .returning({ id: matrixTable.id });

                  return result;
                },
                { response: t.Object({ id: t.String() }) }
              )
        )
  )
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
