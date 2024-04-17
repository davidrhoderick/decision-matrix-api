import { json, pgTable, text } from "drizzle-orm/pg-core";
import { userTable } from "./users-sessions";
import { relations } from "drizzle-orm";

export const matrixTable = pgTable("matrix", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("My Decision"),
  choices: json("choices")
    .$type<Choices>()
    .notNull()
    .default({ list: ["Choice 1", "Choice 2"] }),
  factors: json("factors")
    .$type<Factors>()
    .notNull()
    .default({ list: ["Factor 1", "Factor 2"] }),
  factorsChoices: json("factorsChoices")
    .$type<FactorsChoices>()
    .notNull()
    .default({
      matrix: [
        [1, 2],
        [3, -1],
      ],
    }),
  userId: text("userId").notNull(),
});

export const userRelations = relations(userTable, ({ many }) => ({
  matrices: many(matrixTable),
}));

export const matrixRelations = relations(matrixTable, ({ one }) => ({
  owner: one(userTable, {
    fields: [matrixTable.userId],
    references: [userTable.id],
  }),
}));

export interface Choices {
  list: Array<string>;
}

export interface Factors {
  list: Array<string>;
}

export interface FactorsChoices {
  matrix: Array<Array<number>>;
}

export interface Matrix {
  id: string;
  name: string;
  choices: Choices;
  factors: Factors;
  factorsChoices: FactorsChoices;
}
