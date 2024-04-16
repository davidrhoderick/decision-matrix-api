import { migrate } from "drizzle-orm/node-postgres/migrator";
import db, { client } from "./src/lib/db";

// This will run migrations on the database, skipping the ones already applied
await migrate(db, { migrationsFolder: "./drizzle" });

// Don't forget to close the connection, otherwise the script will hang
await client.end();
