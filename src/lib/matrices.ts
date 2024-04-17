import { json, pgTable, text } from "drizzle-orm/pg-core";
import { userTable } from "./users-sessions";
import { relations } from "drizzle-orm";

export const matrixTable = pgTable("matrix", {
  id: text("id").primaryKey(),
  choices: json("choices").default(
    JSON.stringify({ list: ["Choice 1", "Choice 2"] })
  ),
  factors: json("factors").default(
    JSON.stringify({ list: ["Factor 1", "Factor 2"] })
  ),
  factorsChoices: json("factorsChoices").default(
    JSON.stringify({
      matrix: [
        [1, 2],
        [3, -1],
      ],
    })
  ),
  user_id: text("user_id"),
});

export const userRelations = relations(userTable, ({ many }) => ({
  matrices: many(matrixTable),
}));

export const matrixRelations = relations(matrixTable, ({ one }) => ({
  owner: one(userTable, {
    fields: [matrixTable.user_id],
    references: [userTable.id],
  }),
}));
