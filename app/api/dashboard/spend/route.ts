import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getSpendSeries } from "@/lib/dashboard";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? 30);
  const data = await getSpendSeries(session.user.id, Math.min(Math.max(days, 1), 30));
  return NextResponse.json(data);
}
