import Elysia, { t } from "elysia";

import { Session, generateId } from "lucia";

import db from "@/lib/db";

import { and, eq } from "drizzle-orm";
import validateSession from "@/lib/auth/validate-session";
import { matrixTable } from "@/lib/matrices";

const matrix = new Elysia()
  .model({
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
            detail: { tags: ["Matrix"] },
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
            detail: { tags: ["Matrix"] },
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
          { response: "matrix", detail: { tags: ["Matrix"] } }
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
            detail: { tags: ["Matrix"] },
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
                  detail: { tags: ["Matrix"] },
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
                {
                  response: t.Object({ id: t.String() }),
                  detail: { tags: ["Matrix"] },
                }
              )
        )
  );

export default matrix;
