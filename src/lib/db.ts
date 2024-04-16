import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

export const client = new Client({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
});

await client.connect();

export default drizzle(client);
