import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import packageJson from "../../../package.json";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  heading: "Health Check",
  version: "App Version",
  environment: "Environment",
  database: "Database",
  checking: "Checking...",
  connected: "Connected",
  notConnected: "Not Connected",
} as const;

// Postgres and the API answer with these codes when the table does not exist.
// That still proves the database was reached, so it counts as connected.
const REACHED_CODES = new Set(["PGRST205", "42P01"]);

async function checkDatabase(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("health_check")
      .select("*")
      .limit(1);
    return !error || REACHED_CODES.has(error.code);
  } catch {
    return false;
  }
}

async function DatabaseStatus() {
  await connection();
  const ok = await checkDatabase();

  return (
    <span
      className={`inline-flex items-center gap-2 font-semibold ${
        ok ? "text-success" : "text-error"
      }`}
    >
      <span aria-hidden="true">{ok ? "✓" : "✕"}</span>
      {ok ? text.connected : text.notConnected}
    </span>
  );
}

// Shows no keys, addresses or data. Only the version, the environment name
// and whether the database answered.
export default function HealthPage() {
  const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <section className="w-full max-w-[340px] rounded-2xl bg-surface p-5 shadow-card">
        <h1 className="mb-4 text-center text-[1.25rem] font-semibold tracking-[-0.02em]">
          {text.heading}
        </h1>
        <dl className="divide-y divide-border-soft text-[0.9rem]">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-muted">{text.version}</dt>
            <dd className="font-medium">{packageJson.version}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-muted">{text.environment}</dt>
            <dd className="font-medium capitalize">{environment}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-muted">{text.database}</dt>
            <dd>
              <Suspense fallback={<span className="text-muted">{text.checking}</span>}>
                <DatabaseStatus />
              </Suspense>
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
