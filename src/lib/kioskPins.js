import crypto from "crypto";

// Kiosk PINs (client request 2026-10-02). Every person who signs in at the
// front-desk kiosk - staff, parents and pickup people - has a 6-digit PIN
// that nobody else has. An admin issues a temporary 6-digit registration code;
// at the kiosk the person enters it and chooses their PIN.
//
// pinLookup is an HMAC of the PIN: it finds the owner and enforces uniqueness
// without storing the PIN in the clear. pinCipher is the PIN encrypted with
// AES-256-GCM so its owner can view it after re-entering their password.
// Both keys are derived from the app secret, so rotating that secret makes
// existing PINs unreadable and everyone would need a new registration code.

export const PIN_LENGTH = 6;
export const REGISTRATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PIN_PATTERN = /^\d{6}$/;

function appSecret() {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("JWT_SECRET or NEXTAUTH_SECRET must be set to use kiosk PINs");
  return secret;
}

function derivedKey(label) {
  return crypto.createHash("sha256").update(`ameris-kiosk:${label}:${appSecret()}`).digest();
}

export function isValidPin(value) {
  return PIN_PATTERN.test(String(value ?? ""));
}

export function generateSixDigitCode() {
  return String(crypto.randomInt(0, 10 ** PIN_LENGTH)).padStart(PIN_LENGTH, "0");
}

export function pinLookupOf(pin) {
  return crypto.createHmac("sha256", derivedKey("pin-lookup")).update(String(pin)).digest("hex");
}

function registrationLookupOf(code) {
  return crypto.createHmac("sha256", derivedKey("registration-lookup")).update(String(code)).digest("hex");
}

export function encryptPin(pin) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", derivedKey("pin-encryption"), iv);
  const encrypted = Buffer.concat([cipher.update(String(pin), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64")).join(".");
}

export function decryptPin(value) {
  if (!value) return null;
  const [iv, tag, encrypted] = String(value).split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", derivedKey("pin-encryption"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function ownerWhere({ userId, pickupPersonId }) {
  if (Boolean(userId) === Boolean(pickupPersonId)) {
    throw new Error("Pass exactly one of userId or pickupPersonId");
  }
  return userId ? { userId } : { pickupPersonId };
}

/**
 * Issues a fresh temporary registration code for a person and cancels their
 * current PIN, so a lost or shared PIN stops working straight away.
 * Returns { code, expiresAt }; only the code's hash is stored.
 */
export async function issueRegistrationCode(db, { userId, pickupPersonId, issuedById }) {
  const where = ownerWhere({ userId, pickupPersonId });
  const expiresAt = new Date(Date.now() + REGISTRATION_TTL_MS);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateSixDigitCode();
    const registrationLookup = registrationLookupOf(code);
    const clash = await db.kioskCredential.findUnique({ where: { registrationLookup } });
    if (clash && clash.registrationExpiresAt > new Date()) continue;
    if (clash) {
      // An expired code with the same digits: free it up.
      await db.kioskCredential.update({
        where: { id: clash.id },
        data: { registrationLookup: null, registrationExpiresAt: null },
      });
    }
    const data = {
      registrationLookup,
      registrationExpiresAt: expiresAt,
      registrationIssuedById: issuedById || null,
      pinLookup: null,
      pinCipher: null,
      pinSetAt: null,
    };
    await db.kioskCredential.upsert({ where, update: data, create: { ...where, ...data } });
    return { code, expiresAt };
  }
  throw new Error("Could not issue a unique registration code; try again");
}

/** The credential a still-valid registration code belongs to, with its owner. */
export async function findByRegistrationCode(db, code) {
  if (!isValidPin(code)) return null;
  const credential = await db.kioskCredential.findUnique({
    where: { registrationLookup: registrationLookupOf(code) },
    include: { user: true, pickupPerson: true },
  });
  if (!credential || !credential.registrationExpiresAt || credential.registrationExpiresAt <= new Date()) {
    return null;
  }
  return credential;
}

export class PinError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Sets a person's PIN from their registration code and uses the code up.
 * Throws PinError("INVALID_CODE" | "INVALID_PIN" | "PIN_TAKEN").
 */
export async function setPinWithRegistrationCode(db, { code, pin }) {
  if (!isValidPin(pin)) throw new PinError("INVALID_PIN", "Your PIN must be 6 digits.");
  const credential = await findByRegistrationCode(db, code);
  if (!credential) throw new PinError("INVALID_CODE", "That registration number is not valid or has expired.");
  const pinLookup = pinLookupOf(pin);
  const taken = await db.kioskCredential.findUnique({ where: { pinLookup } });
  if (taken && taken.id !== credential.id) {
    throw new PinError("PIN_TAKEN", "That PIN is not available. Please choose a different one.");
  }
  try {
    return await db.kioskCredential.update({
      where: { id: credential.id },
      data: {
        pinLookup,
        pinCipher: encryptPin(pin),
        pinSetAt: new Date(),
        registrationLookup: null,
        registrationExpiresAt: null,
        registrationIssuedById: null,
      },
      include: { user: true, pickupPerson: true },
    });
  } catch (error) {
    // Someone else claimed the same PIN between the check and the update.
    if (error?.code === "P2002") {
      throw new PinError("PIN_TAKEN", "That PIN is not available. Please choose a different one.");
    }
    throw error;
  }
}

/** The credential (with its user or pickup person) a PIN belongs to, or null. */
export async function findByPin(db, pin) {
  if (!isValidPin(pin)) return null;
  return db.kioskCredential.findUnique({
    where: { pinLookup: pinLookupOf(pin) },
    include: { user: true, pickupPerson: true },
  });
}

/** Safe summary of a credential for admin screens: never the PIN or its hashes. */
export function pinStatusOf(credential) {
  const now = new Date();
  const registrationPending = Boolean(
    credential?.registrationExpiresAt && credential.registrationExpiresAt > now,
  );
  return {
    hasPin: Boolean(credential?.pinSetAt),
    pinSetAt: credential?.pinSetAt || null,
    registrationPending,
    registrationExpiresAt: registrationPending ? credential.registrationExpiresAt : null,
  };
}
