import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    qlooConfigured: Boolean(process.env.QLOO_API_KEY),
    llmProvider: process.env.LLM_PROVIDER || "none",
    llmModel: process.env.LLM_MODEL || null,
    llmConfigured: process.env.LLM_PROVIDER === "openrouter" && Boolean(process.env.OPENROUTER_API_KEY),
    // Deliberately never reveal keys or credential fragments.
  });
}
