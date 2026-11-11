// DocuSign eSignature over fetch (no SDK), signed in with JWT as the user who
// gave consent. Settings come from .env:
//   DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID,
//   DOCUSIGN_BASE_URI (https://demo.docusign.net), DOCUSIGN_AUTH_SERVER
//   (account-d.docusign.com), DOCUSIGN_PRIVATE_KEY_PATH (the RSA private key
//   file, never committed).
import crypto from "crypto";
import fs from "fs";
import path from "path";

const env = (k) => String(process.env[k] || "").trim();

function privateKey() {
  const file = env("DOCUSIGN_PRIVATE_KEY_PATH");
  if (!file) return null;
  try {
    return fs.readFileSync(path.isAbsolute(file) ? file : path.join(process.cwd(), file), "utf8");
  } catch {
    return null;
  }
}

export function docusignConfigured() {
  return ["DOCUSIGN_INTEGRATION_KEY", "DOCUSIGN_USER_ID", "DOCUSIGN_ACCOUNT_ID", "DOCUSIGN_BASE_URI", "DOCUSIGN_AUTH_SERVER"].every(env) && Boolean(privateKey());
}

const b64url = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
let cached = null; // { token, expiresAt }

async function accessToken() {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const key = privateKey();
  if (!key) throw Object.assign(new Error("DocuSign isn't set up yet."), { status: 503 });
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url({ alg: "RS256", typ: "JWT" })}.${b64url({
    iss: env("DOCUSIGN_INTEGRATION_KEY"),
    sub: env("DOCUSIGN_USER_ID"),
    aud: env("DOCUSIGN_AUTH_SERVER"),
    iat: now,
    exp: now + 3600,
    scope: "signature impersonation",
  })}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(key).toString("base64url");
  const res = await fetch(`https://${env("DOCUSIGN_AUTH_SERVER")}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // consent_required: open the consent link once as the DocuSign user.
    throw Object.assign(new Error(`DocuSign sign-in failed (${data.error || res.status})`), { status: 502 });
  }
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return cached.token;
}

async function call(method, route, body, { raw = false } = {}) {
  const url = `${env("DOCUSIGN_BASE_URI").replace(/\/+$/, "")}/restapi/v2.1/accounts/${env("DOCUSIGN_ACCOUNT_ID")}${route}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data.message || `DocuSign error ${res.status}`), { status: 502, docusign: data });
  }
  return raw ? Buffer.from(await res.arrayBuffer()) : res.json();
}

/**
 * Sends an envelope for embedded signing (no email to the signer).
 * documents: [{ name, fileExtension, base64 }]; anchors: { sign, date } text
 * placed in the first document where the signature and date go.
 */
export function createEnvelope({ emailSubject, documents, signer, anchors, metadata = {} }) {
  const tab = (anchorString, extra = {}) => ({ anchorString, anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "0", anchorIgnoreIfNotPresent: "false", ...extra });
  return call("POST", "/envelopes", {
    emailSubject: emailSubject.slice(0, 100),
    status: "sent",
    documents: documents.map((d, i) => ({ documentId: String(i + 1), name: d.name, fileExtension: d.fileExtension, documentBase64: d.base64 })),
    recipients: {
      signers: [
        {
          recipientId: "1",
          routingOrder: "1",
          name: signer.name,
          email: signer.email,
          clientUserId: signer.clientUserId,
          tabs: {
            signHereTabs: [tab(anchors.sign, { anchorYOffset: "-6" })],
            dateSignedTabs: [tab(anchors.date)],
          },
        },
      ],
    },
    customFields: { textCustomFields: Object.entries(metadata).map(([name, value]) => ({ name, value: String(value), show: "false" })) },
  });
}

/** The URL where the signer signs on DocuSign; DocuSign sends them to returnUrl after. */
export async function signingUrl(envelopeId, signer, returnUrl) {
  const view = await call("POST", `/envelopes/${encodeURIComponent(envelopeId)}/views/recipient`, {
    returnUrl,
    authenticationMethod: "none",
    userName: signer.name,
    email: signer.email,
    clientUserId: signer.clientUserId,
  });
  return view.url;
}

export const getEnvelope = (envelopeId) => call("GET", `/envelopes/${encodeURIComponent(envelopeId)}`);

/** "combined" = every signed document as one PDF; "certificate" = the completion certificate. */
export const downloadEnvelopeDocument = (envelopeId, which) =>
  call("GET", `/envelopes/${encodeURIComponent(envelopeId)}/documents/${which}${which === "combined" ? "?certificate=false" : ""}`, null, { raw: true });
