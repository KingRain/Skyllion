// Applies db/schema.sql over the direct (unpooled) connection, as the Neon skill advises for migrations.
// Run: node --env-file=.env.local scripts/migrate.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL_UNPOOLED missing. Run `neon deploy` first.");
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
await client.end();
console.log("schema applied");
