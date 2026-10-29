import { NextResponse } from "next/server";
import { runHeritageAgent } from "@/lib/agent";
import { parseJourneyInput } from "@/lib/input";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = parseJourneyInput(await request.json());
    return NextResponse.json(await runHeritageAgent(input), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to build this journey." }, { status: 400 });
  }
}
