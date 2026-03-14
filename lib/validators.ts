import { z } from "zod";

export const subscriptionSchema = z.object({
  providerId: z.string().min(1),
  planName: z.string().min(1),
  billingCycle: z.enum(["MONTHLY", "YEARLY", "CUSTOM"]),
  price: z.number().nonnegative(),
  currency: z.string().length(3).default("USD"),
  renewalDate: z.string().datetime(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

export const credentialSchema = z.object({
  providerId: z.string().min(1),
  label: z.string().min(1),
  secret: z.string().min(8),
  notes: z.string().max(500).optional(),
  visibilityLevel: z.enum(["MASKED", "REVEALABLE"]).default("REVEALABLE"),
});

export const syncSchema = z.object({
  providerId: z.string().optional(),
  trigger: z.enum(["MANUAL", "CRON"]).default("MANUAL"),
});

export const alertRuleSchema = z.object({
  providerId: z.string().optional(),
  type: z.enum(["USAGE_THRESHOLD", "SUBSCRIPTION_RENEWAL"]),
  threshold: z.number().int().min(1).max(100).optional(),
  renewalLeadDays: z.number().int().min(1).max(30).optional(),
  channels: z.array(z.enum(["IN_APP", "EMAIL"])).min(1),
  isEnabled: z.boolean().default(true),
});
