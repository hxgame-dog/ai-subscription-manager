import crypto from "crypto";
import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";

process.env.MASTER_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");

describe("crypto", () => {
  it("encrypts and decrypts", () => {
    const plain = "sk-live-abcdef1234567890";
    const enc = encryptSecret(plain);
    const dec = decryptSecret(enc);
    expect(dec).toBe(plain);
  });

  it("masks secret", () => {
    expect(maskSecret("sk-live-abcdef")).toBe("sk-l...cdef");
  });
});
