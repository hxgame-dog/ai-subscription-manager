import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getMasterKey() {
  const key = process.env.MASTER_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("MASTER_ENCRYPTION_KEY is required");
  }
  const parsed = Buffer.from(key, "base64");
  if (parsed.length !== 32) {
    throw new Error("MASTER_ENCRYPTION_KEY must be base64 encoded 32 bytes");
  }
  return parsed;
}

function aesEncrypt(plain: Buffer, key: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted,
    iv,
    tag,
  };
}

function aesDecrypt(ciphertext: Buffer, key: Buffer, iv: Buffer, tag: Buffer) {
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export type EncryptedSecret = {
  encryptedDek: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
  fingerprint: string;
};

export function encryptSecret(secret: string): EncryptedSecret {
  const masterKey = getMasterKey();
  const dek = crypto.randomBytes(32);

  const secretEncrypted = aesEncrypt(Buffer.from(secret, "utf8"), dek);
  const wrappedDek = aesEncrypt(dek, masterKey);

  return {
    encryptedDek: Buffer.concat([wrappedDek.iv, wrappedDek.tag, wrappedDek.ciphertext]).toString("base64"),
    encryptedValue: secretEncrypted.ciphertext.toString("base64"),
    iv: secretEncrypted.iv.toString("base64"),
    authTag: secretEncrypted.tag.toString("base64"),
    fingerprint: crypto.createHash("sha256").update(secret).digest("hex").slice(0, 16),
  };
}

function unwrapDek(encryptedDek: string) {
  const masterKey = getMasterKey();
  const buf = Buffer.from(encryptedDek, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  return aesDecrypt(ciphertext, masterKey, iv, tag);
}

export function decryptSecret(payload: {
  encryptedDek: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
}) {
  const dek = unwrapDek(payload.encryptedDek);
  const plaintext = aesDecrypt(
    Buffer.from(payload.encryptedValue, "base64"),
    dek,
    Buffer.from(payload.iv, "base64"),
    Buffer.from(payload.authTag, "base64"),
  );
  return plaintext.toString("utf8");
}

export function maskSecret(value: string) {
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
