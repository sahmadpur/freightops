/**
 * Regenerate the binary app icons from src/app/icon.svg.
 *   npx tsx scripts/gen-icons.mts
 *
 * Writes:
 *   - src/app/apple-icon.png  (180×180)
 *   - src/app/favicon.ico     (32×32 PNG wrapped in a minimal ICO container)
 *
 * PNG-encoded ICO entries are valid and supported by all modern browsers.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "src", "app");

const svg = await readFile(join(appDir, "icon.svg"));

// apple-icon: 180×180 PNG
await writeFile(join(appDir, "apple-icon.png"), await sharp(svg).resize(180, 180).png().toBuffer());

// favicon.ico: wrap a 32×32 PNG in an ICO container
const png = await sharp(svg).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // image count
const entry = Buffer.alloc(16);
entry.writeUInt8(32, 0); // width (0 = 256, here 32)
entry.writeUInt8(32, 1); // height
entry.writeUInt8(0, 2); // palette count
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // color planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(png.length, 8); // image data size
entry.writeUInt32LE(header.length + entry.length, 12); // offset to image data
await writeFile(join(appDir, "favicon.ico"), Buffer.concat([header, entry, png]));

console.log("Wrote apple-icon.png (180) and favicon.ico (32) from icon.svg");
