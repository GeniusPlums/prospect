import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { isMigrationFile, pendingMigrations } from "../../scripts/migration-plan.mjs";

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

let ready: Promise<Queryable> | undefined;
let pglite: PGlite | undefined;
let pool: pg.Pool | undefined;

function migrationsDir(): string {
  try {
    return join(dirname(fileURLToPath(import.meta.url)), "../../migrations");
  } catch {
    return join(process.cwd(), "migrations");
  }
}

async function applySql(client: Queryable, text: string) {
  const stripped = text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("--")) return "";
      return line;
    })
    .join("\n");
  const chunks = stripped
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const chunk of chunks) {
    await client.query(chunk.endsWith(";") ? chunk : `${chunk};`);
  }
}

async function migrate(client: Queryable, root: string) {
  await client.query(
    `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  );
  const applied = (await client.query(`SELECT name FROM _migrations`)).rows.map((r) =>
    String(r.name),
  );
  let entries: string[] = [];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const { name } of pendingMigrations(entries, applied)) {
    if (!isMigrationFile(name)) continue;
    const text = readFileSync(join(root, name), "utf8");
    await applySql(client, text);
    await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [name]);
  }
}

async function tryHnsw(client: Queryable) {
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await client.query(
      `ALTER TABLE candidate ADD COLUMN IF NOT EXISTS embedding_vec vector(64)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS candidate_embedding_hnsw ON candidate USING hnsw (embedding_vec vector_cosine_ops)`,
    );
  } catch {
    // PGLite / engines without pgvector keep jsonb embeddings + in-process cosine.
  }
}

function asQueryable(db: PGlite): Queryable {
  return {
    async query(text, params = []) {
      const result = await db.query(text, params as never[]);
      return { rows: (result.rows ?? []) as Record<string, unknown>[] };
    },
  };
}

async function connect(): Promise<Queryable> {
  const url = process.env.DATABASE_URL;
  if (url) {
    pool = new pg.Pool({
      connectionString: url,
      max: 4,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 10_000,
    });
    const client: Queryable = {
      async query(text, params = []) {
        const result = await pool!.query(text, params);
        return { rows: result.rows as Record<string, unknown>[] };
      },
    };
    // Schema is applied at deploy (`npm run db:migrate`). Skipping migrate +
    // CREATE EXTENSION on the request path avoids a 30s+ hang on cold start.
    return client;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  pglite = new PGlite();
  const client = asQueryable(pglite);
  await migrate(client, migrationsDir());
  await tryHnsw(client);
  return client;
}

export async function ensureDbReady(): Promise<void> {
  if (!ready) {
    ready = connect();
    await ready;
    const { seedIfEmpty } = await import("@/lib/index/seed");
    await seedIfEmpty();
  } else {
    await ready;
  }
}

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureDbReady();
  const client = await ready!;
  const result = await client.query(text, params);
  return result.rows as T[];
}

export async function sqlOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await sql<T>(text, params);
  return rows[0];
}

/** One round-trip multi-row INSERT. `prefix` is `INSERT INTO t (cols) VALUES`. */
export async function insertMany(
  prefix: string,
  rows: unknown[][],
  casts: Array<string | undefined> = [],
): Promise<void> {
  if (rows.length === 0) return;
  const params: unknown[] = [];
  const tuples = rows.map((row) => {
    const cells = row.map((val, j) => {
      params.push(val);
      const cast = casts[j];
      return cast ? `$${params.length}::${cast}` : `$${params.length}`;
    });
    return `(${cells.join(",")})`;
  });
  await sql(`${prefix} ${tuples.join(",")}`, params);
}

export { pglite, pool };
