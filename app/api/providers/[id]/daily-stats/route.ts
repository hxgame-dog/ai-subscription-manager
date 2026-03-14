import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getProviderDailyStats } from "@/lib/dashboard";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? 30);
  const { id } = await context.params;
  const data = await getProviderDailyStats(session.user.id, id, Math.min(Math.max(days, 1), 30));
  if (!data) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
