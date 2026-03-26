import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { runSyncJob } from "@/lib/sync-engine";
import { syncSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = syncSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await runSyncJob({
      userId: session.user.id,
      providerId: parsed.data.providerId,
      trigger: parsed.data.trigger,
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "SYNC_TRIGGER",
      resource: "SyncJob",
      resourceId: result.jobId,
      outcome: "SUCCESS",
      metadata: { trigger: parsed.data.trigger, message: result.message },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";

    await writeAuditLog({
      userId: session.user.id,
      action: "SYNC_TRIGGER",
      resource: "SyncJob",
      outcome: "ERROR",
      metadata: { message },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
