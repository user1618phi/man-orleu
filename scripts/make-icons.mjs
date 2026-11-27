// Generates solid PWA icons without native deps: violet field, white square mark.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const bg = [0x9c, 0x43, 0xe5], fg = [0xff, 0xff, 0xff];
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const s0 = Math.round(size * 0.34), s1 = Math.round(size * 0.66);
  const b0 = Math.round(size * 0.30), b1 = Math.round(size * 0.70), bt = Math.round(size * 0.045);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      // a square outline with a filled inner square: the "mark" motif
      const inFill = x >= s0 + bt * 2 && x < s1 - bt * 2 && y >= s0 + bt * 2 && y < s1 - bt * 2;
      const inRing = x >= b0 && x < b1 && y >= b0 && y < b1 && !(x >= b0 + bt && x < b1 - bt && y >= b0 + bt && y < b1 - bt);
      const c = inFill || inRing ? fg : bg;
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}
for (const s of [192, 512]) writeFileSync(`public/icon-${s}.png`, png(s));
writeFileSync("public/apple-touch-icon.png", png(180));
