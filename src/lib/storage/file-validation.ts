/**
 * File validation shared by client (fast feedback) and server (enforcement).
 *
 * The server never trusts the browser's Content-Type or the file extension:
 * after an upload it reads the first bytes of the stored object and checks
 * the file signature ("magic bytes") against the declared type. Active
 * content (HTML, SVG, scripts) is never accepted, and private files are
 * always served as downloads through short-lived signed URLs.
 */

export type UploadPurpose = "avatar" | "portfolio" | "requirement" | "deliverable" | "message" | "dispute";

export type FileFamily = "png" | "jpeg" | "gif" | "webp" | "pdf" | "zip" | "mp4" | "mp3" | "wav" | "text";

const MIME_FAMILY: Record<string, FileFamily> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/zip": "zip",
  // Office Open XML documents are ZIP containers.
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "zip",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "zip",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "zip",
  "video/mp4": "mp4",
  "video/quicktime": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "text/plain": "text",
  "text/csv": "text",
};

const MB = 1024 * 1024;
const IMAGES = ["image/png", "image/jpeg", "image/webp"];
const DOCUMENTS = [
  "application/pdf",
  "application/zip",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
const MEDIA = ["video/mp4", "video/quicktime", "audio/mpeg", "audio/wav"];

/** Mirrors the bucket limits in supabase/migrations/20261009000800_storage.sql. */
export const UPLOAD_RULES: Record<UploadPurpose, { bucket: string; maxBytes: number; mimeTypes: string[] }> = {
  avatar: { bucket: "avatars", maxBytes: 2 * MB, mimeTypes: IMAGES },
  portfolio: { bucket: "portfolio", maxBytes: 10 * MB, mimeTypes: [...IMAGES, "image/gif"] },
  requirement: { bucket: "requirement-files", maxBytes: 25 * MB, mimeTypes: [...IMAGES, "image/gif", ...DOCUMENTS] },
  deliverable: { bucket: "order-files", maxBytes: 50 * MB, mimeTypes: [...IMAGES, "image/gif", ...DOCUMENTS, ...MEDIA] },
  message: { bucket: "order-files", maxBytes: 50 * MB, mimeTypes: [...IMAGES, "image/gif", ...DOCUMENTS, ...MEDIA] },
  dispute: { bucket: "order-files", maxBytes: 25 * MB, mimeTypes: [...IMAGES, ...DOCUMENTS] },
};

export function acceptAttribute(purpose: UploadPurpose): string {
  return UPLOAD_RULES[purpose].mimeTypes.join(",");
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

/** Quick pre-upload check on metadata (client and server). */
export function validateFileMetadata(purpose: UploadPurpose, file: { size: number; type: string; name: string }): ValidationResult {
  const rules = UPLOAD_RULES[purpose];
  if (file.size <= 0) return { ok: false, error: "The file is empty." };
  if (file.size > rules.maxBytes) {
    return { ok: false, error: `Files must be ${Math.round(rules.maxBytes / MB)} MB or smaller.` };
  }
  if (!rules.mimeTypes.includes(file.type)) {
    return { ok: false, error: "This file type isn't supported here." };
  }
  if (file.name.length > 200) return { ok: false, error: "The file name is too long." };
  return { ok: true };
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

/** Detects the real file family from its leading bytes. */
export function sniffFileFamily(bytes: Uint8Array): FileFamily | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") return "gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") return "wav";
  if (ascii(bytes, 0, 5) === "%PDF-") return "pdf";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) return "zip";
  if (ascii(bytes, 4, 4) === "ftyp") return "mp4";
  if (ascii(bytes, 0, 3) === "ID3" || startsWith(bytes, [0xff, 0xfb]) || startsWith(bytes, [0xff, 0xf3]) || startsWith(bytes, [0xff, 0xf2])) {
    return "mp3";
  }
  if (looksLikeText(bytes)) return "text";
  return null;
}

function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  const sample = bytes.slice(0, 4096);
  if (sample.includes(0)) return false;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(sample);
    // Refuse markup that browsers could execute if mis-served.
    return !/<\s*(script|html|svg|iframe|object|embed)\b/i.test(text);
  } catch {
    return false;
  }
}

/** Server-side check that stored bytes match the declared type. */
export function verifyFileSignature(declaredMime: string, leadingBytes: Uint8Array): ValidationResult {
  const expected = MIME_FAMILY[declaredMime];
  if (!expected) return { ok: false, error: "This file type isn't supported." };
  const actual = sniffFileFamily(leadingBytes);
  if (actual !== expected) {
    return { ok: false, error: "The file contents don't match its type. Please upload a valid file." };
  }
  return { ok: true };
}

/** Safe object name: keeps a readable, ASCII-only version of the original name. */
export function storageFileName(originalName: string, id: string): string {
  // Drop any directory components a client may have sent.
  const name = originalName.split(/[/\\]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const extension = dot > 0 ? name.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase() : "";
  return `${id}-${base || "file"}${extension ? `.${extension}` : ""}`;
}
