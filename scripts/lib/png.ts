/**
 * Minimal PNG encoder used only by the development seed to generate
 * abstract placeholder artwork (no external image assets required).
 */
import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

type RGB = [number, number, number];

function hex(color: string): RGB {
  const value = color.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

/** Abstract composition: background, a large circle and a rounded bar. */
export function placeholderArtwork(width: number, height: number, palette: [string, string, string], seed: number): Buffer {
  const [bg, a, b] = palette.map(hex) as [RGB, RGB, RGB];
  const cx = width * (0.3 + ((seed * 37) % 40) / 100);
  const cy = height * (0.35 + ((seed * 17) % 30) / 100);
  const radius = Math.min(width, height) * (0.22 + ((seed * 13) % 12) / 100);
  const barTop = height * 0.68;
  const barBottom = height * 0.8;
  const barLeft = width * 0.12;
  const barRight = width * (0.55 + ((seed * 7) % 30) / 100);

  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      let color = bg;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) color = a;
      if (y >= barTop && y <= barBottom && x >= barLeft && x <= barRight) color = b;
      const offset = row + 1 + x * 3;
      raw[offset] = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
