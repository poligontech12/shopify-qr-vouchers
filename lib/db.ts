import { Pool, type QueryResult, type QueryResultRow } from "pg";

// Single shared pool — Next.js dev mode re-evaluates modules on hot reload,
// so we cache it on globalThis to avoid leaking pools.
declare global {
  var __pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (!globalThis.__pgPool) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) throw new Error("POSTGRES_URL is not set");
    globalThis.__pgPool = new Pool({
      connectionString,
      // Vercel Postgres (Neon) requires SSL; local Postgres usually doesn't.
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
    });
  }
  return globalThis.__pgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: ReadonlyArray<unknown>,
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as unknown[] | undefined);
}
