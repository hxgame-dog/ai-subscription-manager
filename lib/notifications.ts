import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

type NotificationPayload = {
  userId: string;
  ruleId?: string;
  type: "USAGE_THRESHOLD" | "SUBSCRIPTION_RENEWAL";
  title: string;
  message: string;
  channels: Array<"IN_APP" | "EMAIL">;
  metadata?: Prisma.InputJsonValue;
};

async function sendEmail(to: string, subject: string, body: string) {
  // Replace with provider integration (Resend/SendGrid/etc.) in production.
  console.log("email", { to, subject, body, from: process.env.EMAIL_FROM });
}

export async function sendNotification(payload: NotificationPayload) {
  for (const channel of payload.channels) {
    const event = await prisma.alertEvent.create({
      data: {
        userId: payload.userId,
        ruleId: payload.ruleId,
        type: payload.type,
        channel,
        title: payload.title,
        message: payload.message,
        metadata: payload.metadata,
      },
    });

    if (channel === "EMAIL") {
      const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { email: true } });
      if (user?.email) {
        await sendEmail(user.email, payload.title, payload.message);
      }
    }

    await prisma.alertEvent.update({ where: { id: event.id }, data: { sentAt: new Date() } });
  }
}
