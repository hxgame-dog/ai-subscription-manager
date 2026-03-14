import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getCredentialUsageStats } from "@/lib/dashboard";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const data = await getCredentialUsageStats(session.user.id, id);
  if (!data) {
    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }

  return NextResponse.json({
    totals: data.totals,
    models: data.models,
    latestUsage: data.latestUsage,
    latestSpend: data.latestSpend,
    accessEvents: data.accessEvents,
  });
}
