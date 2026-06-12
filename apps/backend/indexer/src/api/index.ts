import { Hono } from "hono";

// Ponder's `ponder start` requires an API entry file exporting a Hono app.
// The Trezo mobile app reads chain data from Supabase (the indexer projects incoming
// transfers / events straight into Supabase), so we don't expose GraphQL/SQL here —
// just a lightweight liveness route. Ponder also serves its own /health and /status.
const app = new Hono();

app.get("/", (c) => c.json({ service: "trezo-indexer", ok: true }));

export default app;
