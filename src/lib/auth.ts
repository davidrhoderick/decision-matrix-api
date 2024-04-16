import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { Lucia, TimeSpan } from "lucia";

import db from "./db";
import { userTable, sessionTable, DatabaseUser } from "./users-sessions";

const adapter = new DrizzlePostgreSQLAdapter(db, sessionTable, userTable);

const lucia = new Lucia(adapter, {
  sessionExpiresIn: new TimeSpan(2, "w"),
  getUserAttributes: (attributes) => {
    return { username: attributes.username };
  },
});

export default lucia;

// IMPORTANT!
declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: Omit<DatabaseUser, "id">;
  }
}
