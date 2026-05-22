// Thin re-export so other modules import a stable surface and we can swap
// drivers later without touching callers.
export { sql } from "@vercel/postgres";
