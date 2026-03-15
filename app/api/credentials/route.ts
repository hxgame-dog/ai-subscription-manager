import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { credentialSchema } from "@/lib/validators";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.apiCredential.findMany({
    where: { userId: session.user.id },
    include: { provider: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    items.map((c) => ({
      id: c.id,
      provider: c.provider.name,
      providerId: c.providerId,
      label: c.label,
      notes: c.notes,
      fingerprint: c.fingerprint,
      status: c.status,
      maskedValue: maskSecret(decryptSecret(c)),
      visibilityLevel: c.visibilityLevel,
      lastUsedAt: c.lastUsedAt,
      lastViewedAt: c.lastViewedAt,
      lastCopiedAt: c.lastCopiedAt,
      createdAt: c.createdAt,
    })),
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(`cred-create:${session.user.id}`, 20, 60_000);
  if (!limit.ok) {
    await writeAuditLog({
      userId: session.user.id,
      action: "CREDENTIAL_CREATE",
      resource: "ApiCredential",
      outcome: "DENIED",
      metadata: { reason: "rate_limit" },
    });
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json();
  const parsed = credentialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const encrypted = encryptSecret(parsed.data.secret);

  const created = await prisma.apiCredential.create({
    data: {
      userId: session.user.id,
      providerId: parsed.data.providerId,
      label: parsed.data.label,
      notes: parsed.data.notes,
      fingerprint: encrypted.fingerprint,
      encryptedDek: encrypted.encryptedDek,
      encryptedValue: encrypted.encryptedValue,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      visibilityLevel: parsed.data.visibilityLevel,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "CREDENTIAL_CREATE",
    resource: "ApiCredential",
    resourceId: created.id,
    outcome: "SUCCESS",
    metadata: { providerId: parsed.data.providerId },
  });

  return NextResponse.json({ id: created.id, status: created.status }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    credentialId: string;
    action: "ROTATE" | "DISABLE" | "ENABLE";
    newSecret?: string;
  };

  const existing = await prisma.apiCredential.findFirst({
    where: { id: body.credentialId, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }

  if (body.action === "DISABLE") {
    const updated = await prisma.apiCredential.update({
      where: { id: existing.id },
      data: { status: "DISABLED" },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "CREDENTIAL_DISABLE",
      resource: "ApiCredential",
      resourceId: updated.id,
      outcome: "SUCCESS",
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
  }

  if (body.action === "ENABLE") {
    const updated = await prisma.apiCredential.update({
      where: { id: existing.id },
      data: { status: "ACTIVE" },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "CREDENTIAL_ENABLE",
      resource: "ApiCredential",
      resourceId: updated.id,
      outcome: "SUCCESS",
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
  }

  if (!body.newSecret) {
    return NextResponse.json({ error: "newSecret is required for ROTATE" }, { status: 400 });
  }

  const encrypted = encryptSecret(body.newSecret);
  const updated = await prisma.apiCredential.update({
    where: { id: existing.id },
    data: {
      status: "ACTIVE",
      encryptedDek: encrypted.encryptedDek,
      encryptedValue: encrypted.encryptedValue,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      fingerprint: encrypted.fingerprint,
      lastViewedAt: null,
      lastCopiedAt: null,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "CREDENTIAL_ROTATE",
    resource: "ApiCredential",
    resourceId: updated.id,
    outcome: "SUCCESS",
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
