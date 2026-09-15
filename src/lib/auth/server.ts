import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import pg from "pg";
import { emailAndPasswordEnabled } from "./email-password";

function createAuth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for auth");
  }
  return betterAuth({
    database: new pg.Pool({
      connectionString: databaseUrl,
      max: 4,
      connectionTimeoutMillis: 8000,
    }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL:
      process.env.BETTER_AUTH_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:8080"),
    trustedOrigins: [
      "https://prospect-chi-lyart.vercel.app",
      "http://localhost:8080",
      "http://127.0.0.1:8080",
      ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
      ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
        : []),
    ],
    emailAndPassword: {
      enabled: emailAndPasswordEnabled,
      minPasswordLength: 8,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
    },
    plugins: [tanstackStartCookies()],
  });
}

type AppAuth = ReturnType<typeof createAuth>;

let cached: AppAuth | undefined;

export function getAuth(): AppAuth {
  if (!cached) cached = createAuth();
  return cached;
}

export const auth = {
  get handler() {
    return getAuth().handler.bind(getAuth());
  },
  get api() {
    return getAuth().api;
  },
};
