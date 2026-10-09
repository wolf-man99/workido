import { describe, expect, it } from "vitest";
import { sniffFileFamily, storageFileName, validateFileMetadata, verifyFileSignature } from "@/lib/storage/file-validation";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe("sniffFileFamily", () => {
  it("detects common signatures", () => {
    expect(sniffFileFamily(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(sniffFileFamily(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(sniffFileFamily(text("GIF89a...."))).toBe("gif");
    expect(sniffFileFamily(text("RIFF\x00\x00\x00\x00WEBPVP8 "))).toBe("webp");
    expect(sniffFileFamily(text("%PDF-1.7"))).toBe("pdf");
    expect(sniffFileFamily(bytes(0x50, 0x4b, 0x03, 0x04, 0x14))).toBe("zip");
    expect(sniffFileFamily(text("\x00\x00\x00\x18ftypmp42"))).toBe("mp4");
    expect(sniffFileFamily(text("ID3\x04"))).toBe("mp3");
    expect(sniffFileFamily(text("name,email\nA,B"))).toBe("text");
  });

  it("rejects executable markup disguised as text", () => {
    expect(sniffFileFamily(text("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniffFileFamily(text('<svg onload="alert(1)"></svg>'))).toBeNull();
  });

  it("rejects binary junk", () => {
    expect(sniffFileFamily(bytes(0x00, 0x01, 0x02, 0x03))).toBeNull();
  });
});

describe("verifyFileSignature", () => {
  it("accepts matching content", () => {
    expect(verifyFileSignature("image/png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toEqual({ ok: true });
    expect(verifyFileSignature("application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes(0x50, 0x4b, 0x03, 0x04))).toEqual({ ok: true });
  });

  it("rejects a file whose extension/type lies about its content", () => {
    // An HTML file renamed to .png and uploaded as image/png.
    expect(verifyFileSignature("image/png", text("<html><body>hi</body></html>")).ok).toBe(false);
    // A PDF uploaded claiming to be a JPEG.
    expect(verifyFileSignature("image/jpeg", text("%PDF-1.4")).ok).toBe(false);
  });

  it("rejects unsupported declared types", () => {
    expect(verifyFileSignature("text/html", text("hello")).ok).toBe(false);
    expect(verifyFileSignature("image/svg+xml", text("<svg/>")).ok).toBe(false);
  });
});

describe("validateFileMetadata", () => {
  it("enforces purpose-specific size and type limits", () => {
    expect(validateFileMetadata("avatar", { size: 1000, type: "image/png", name: "me.png" })).toEqual({ ok: true });
    expect(validateFileMetadata("avatar", { size: 3 * 1024 * 1024, type: "image/png", name: "me.png" }).ok).toBe(false);
    expect(validateFileMetadata("avatar", { size: 1000, type: "application/pdf", name: "cv.pdf" }).ok).toBe(false);
    expect(validateFileMetadata("deliverable", { size: 1000, type: "video/mp4", name: "cut.mp4" })).toEqual({ ok: true });
    expect(validateFileMetadata("deliverable", { size: 0, type: "video/mp4", name: "cut.mp4" }).ok).toBe(false);
  });
});

describe("storageFileName", () => {
  it("produces safe, readable object names", () => {
    expect(storageFileName("Brand Kit (final).PDF", "abc")).toBe("abc-Brand-Kit-final.pdf");
    expect(storageFileName("../../etc/passwd", "abc")).toBe("abc-passwd");
    expect(storageFileName("C:\\Users\\me\\logo.png", "abc")).toBe("abc-logo.png");
    expect(storageFileName("résumé.docx", "x")).toBe("x-resume.docx");
  });
});
