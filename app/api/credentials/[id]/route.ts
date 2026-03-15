import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
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
    credential: {
      id: data.credential.id,
      label: data.credential.label,
      notes: data.credential.notes,
      fingerprint: data.credential.fingerprint,
      maskedValue: maskSecret(decryptSecret(data.credential)),
      status: data.credential.status,
      visibilityLevel: data.credential.visibilityLevel,
      createdAt: data.credential.createdAt,
      lastUsedAt: data.credential.lastUsedAt,
      lastViewedAt: data.credential.lastViewedAt,
      lastCopiedAt: data.credential.lastCopiedAt,
      provider: data.credential.provider,
    },
    totals: data.totals,
    models: data.models,
    latestUsage: data.latestUsage,
    latestSpend: data.latestSpend,
    accessEvents: data.accessEvents,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { action?: "REVEAL" | "COPY"; confirmed?: boolean };
  if (!body.confirmed || !body.action) {
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  }

  const credential = await prisma.apiCredential.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!credential) {
    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }

  const plain = decryptSecret(credential);
  const now = new Date();

  await prisma.credentialAccessEvent.create({
    data: {
      userId: session.user.id,
      credentialId: credential.id,
      action: body.action,
      metadata: { visibilityLevel: credential.visibilityLevel },
    },
  });

  await prisma.apiCredential.update({
    where: { id: credential.id },
    data: body.action === "REVEAL" ? { lastViewedAt: now } : { lastCopiedAt: now },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: body.action === "REVEAL" ? "CREDENTIAL_REVEAL" : "CREDENTIAL_COPY",
    resource: "ApiCredential",
    resourceId: credential.id,
    outcome: "SUCCESS",
  });

  return NextResponse.json({ secret: plain, maskedValue: maskSecret(plain) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { action?: "ROTATE" | "DISABLE" | "ENABLE"; newSecret?: string };
  if (!body.action) {
    return NextResponse.json({ error: "Action is required" }, { status: 400 });
  }

  const credential = await prisma.apiCredential.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!credential) {
    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }

  if (body.action === "DISABLE") {
    const updated = await prisma.apiCredential.update({
      where: { id: credential.id },
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
      where: { id: credential.id },
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

  if (!body.newSecret || body.newSecret.trim().length < 8) {
    return NextResponse.json({ error: "newSecret is required for ROTATE" }, { status: 400 });
  }

  const encrypted = encryptSecret(body.newSecret.trim());
  const updated = await prisma.apiCredential.update({
    where: { id: credential.id },
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

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const credential = await prisma.apiCredential.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!credential) {
    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }

  await prisma.apiCredential.delete({
    where: { id: credential.id },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "CREDENTIAL_DELETE",
    resource: "ApiCredential",
    resourceId: credential.id,
    outcome: "SUCCESS",
  });

  return NextResponse.json({ id: credential.id, deleted: true });
}
