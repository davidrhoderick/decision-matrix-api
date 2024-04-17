import { migrate } from "drizzle-orm/node-postgres/migrator";
import db, { client } from "./src/lib/db";

// This will run migrations on the database, skipping the ones already applied
await migrate(db, { migrationsFolder: "./drizzle" });

// Don't forget to close the connection, otherwise the script will hang
// TODO Should be await client.end() but that just hangs
client.end();
