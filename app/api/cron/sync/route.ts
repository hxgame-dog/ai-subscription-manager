import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { runSyncJob } from "@/lib/sync-engine";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const users = await prisma.user.findMany({
    where: {
      credentials: {
        some: {
          status: "ACTIVE",
          provider: { supportsAutoSync: true },
        },
      },
    },
    select: { id: true },
  });

  const results = [] as Array<{ userId: string; ok: boolean; jobId?: string; error?: string }>;

  for (const user of users) {
    try {
      const result = await runSyncJob({ userId: user.id, trigger: "CRON" });
      results.push({ userId: user.id, ok: true, jobId: result.jobId });
    } catch (error) {
      results.push({
        userId: user.id,
        ok: false,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return NextResponse.json({
    totalUsers: users.length,
    results,
  });
}
