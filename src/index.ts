import { Elysia } from "elysia";

import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

import { swagger } from "@elysiajs/swagger";

const client = new Client({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
});

await client.connect();

const db = drizzle(client);

const app = new Elysia()
  .use(swagger())
  .get("/", () => "Hello Elysia")
  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
