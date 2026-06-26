import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
// Never cache: every hit must reach Supabase so the free-tier project stays active.
export const dynamic = "force-dynamic";

/**
 * GET /api/keepalive
 *
 * Touches the Supabase Postgres database DIRECTLY (via the service-role client)
 * so the free-tier project is not paused for inactivity. This is the only
 * keep-warm path that actually reaches Supabase — the FastAPI backend uses a
 * separate database and cannot keep this project warm.
 *
 * It runs `select now()` through the `keepalive_ping()` RPC, which proves the
 * query executed on Postgres (not a cache or a generic HTTP 200) and returns
 * the real database clock time.
 *
 * Optional bearer-token gate: set the KEEPALIVE_TOKEN env var to require
 *   Authorization: Bearer <token>
 *
 * Responses:
 *   200 { success: true,  databaseTime, latency, source }
 *   401 invalid/missing token (only when KEEPALIVE_TOKEN is configured)
 *   503 Supabase not configured OR unreachable  -> fails the keep-warm workflow
 */
export async function GET(req: NextRequest) {
  const receivedAt = new Date().toISOString();

  // --- Optional token gate ---
  const requiredToken = (process.env.KEEPALIVE_TOKEN || "").trim();
  if (requiredToken) {
    const auth = req.headers.get("authorization") || "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!provided || provided !== requiredToken) {
      console.warn("[keepalive] rejected: invalid or missing bearer token");
      return NextResponse.json(
        { success: false, error: "Invalid keepalive token" },
        { status: 401 },
      );
    }
  }

  // --- Supabase must be configured ---
  if (!supabaseServer) {
    console.error(
      "[keepalive] Supabase client unavailable: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set",
    );
    return NextResponse.json(
      {
        success: false,
        error:
          "Supabase is not configured (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)",
        receivedAt,
      },
      { status: 503 },
    );
  }

  // --- Real query against Supabase Postgres ---
  const start = Date.now();
  const { data, error } = await supabaseServer.rpc("keepalive_ping");
  const latency = Date.now() - start;

  if (error) {
    // PostgREST returns PGRST202 when the RPC does not exist yet.
    const needsMigration = error.code === "PGRST202";
    console.error(
      `[keepalive] Supabase query failed in ${latency}ms: ${error.message}` +
        (needsMigration ? " (apply the keepalive_ping migration)" : ""),
    );
    return NextResponse.json(
      {
        success: false,
        error: needsMigration
          ? "keepalive_ping() RPC is missing — apply supabase/migrations/0001_keepalive_ping.sql"
          : "Supabase unreachable",
        detail: error.message,
        latency,
        receivedAt,
      },
      { status: 503 },
    );
  }

  console.log(
    `[keepalive] OK in ${latency}ms databaseTime=${String(data)} (received ${receivedAt})`,
  );
  return NextResponse.json({
    success: true,
    databaseTime: data,
    latency,
    source: "rpc:keepalive_ping",
    receivedAt,
  });
}
