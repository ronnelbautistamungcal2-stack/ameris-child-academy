// Policies & Procedures and Additional Resources (client mockups 38 and 39):
// who a document is for, and the Add Policy / Add Resource fields. Shared by
// the pages and the API.

import { roleLabel } from "@/lib/roles";

// Subscribers were removed; HR, Kitchen and Student Support were added
// (client request 2026-10-02, 39-03).
export const DOCUMENT_ROLES = ["ADMIN", "COACH", "TEACHER", "KITCHEN_STAFF", "HR_STAFF", "OTHER_STAFF", "STUDENT_SUPPORT", "PARENT"];
export const STAFF_DOCUMENT_ROLES = DOCUMENT_ROLES.filter((r) => r !== "PARENT");

export function documentRoleLabel(role) {
  if (role === "PARENT") return "Parents";
  if (role === "KITCHEN_STAFF") return "Kitchen";
  if (role === "HR_STAFF") return "HR";
  return roleLabel(role);
}

const text = (value, max) => String(value ?? "").trim().slice(0, max);
const isUrl = (value) => /^(https?:\/\/|\/)/i.test(value);

/** Add/Edit Policy or Resource. Returns { data } or { error }. */
export function parseDocument(body = {}, category) {
  const title = text(body.title, 200);
  if (!title) return { error: category === "RESOURCE" ? "Name is required" : "Title is required" };
  const roles = Array.isArray(body.roles) ? [...new Set(body.roles.map(String))] : [];
  if (!roles.length) return { error: "Choose at least one role" };
  if (roles.some((r) => !DOCUMENT_ROLES.includes(r))) return { error: "Unknown role" };
  const websiteUrl = text(body.websiteUrl, 2000) || null;
  const fileUrl = text(body.url, 2000);
  if (websiteUrl && !isUrl(websiteUrl)) return { error: "The website URL should start with https://" };
  const url = fileUrl || websiteUrl;
  if (!url) return { error: category === "RESOURCE" ? "Upload a file or enter a website URL" : "Upload the policy document" };
  const logoUrl = text(body.logoUrl, 2000) || null;
  if (logoUrl && !isUrl(logoUrl)) return { error: "The logo URL should start with https://" };
  const contactEmail = text(body.contactEmail, 200) || null;
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return { error: "The contact email is invalid" };
  return {
    data: {
      title,
      description: text(body.description, 1000) || null,
      url,
      roles,
      category,
      centerId: body.centerId ? String(body.centerId) : null,
      version: text(body.version, 40) || null,
      websiteUrl,
      contactEmail,
      contactPhone: text(body.contactPhone, 40) || null,
      logoUrl,
      showOnHomePage: category === "RESOURCE" && body.showOnHomePage === true,
      active: body.active !== false,
    },
  };
}
