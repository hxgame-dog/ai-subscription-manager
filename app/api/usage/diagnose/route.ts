import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { runProviderDiagnostic } from "@/lib/provider-diagnostics";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { providerKey?: string };
  const providerKey = String(body.providerKey || "").trim();
  if (!providerKey) {
    return NextResponse.json({ error: "providerKey is required" }, { status: 400 });
  }

  const result = await runProviderDiagnostic(providerKey);

  await writeAuditLog({
    userId: session.user.id,
    action: "SYNC_DIAGNOSE",
    resource: "ProviderConnector",
    resourceId: providerKey,
    outcome: result.ok ? "SUCCESS" : "ERROR",
    metadata: result,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 200 });
}
