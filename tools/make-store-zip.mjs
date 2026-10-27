// Build the upload package for the extension stores: dist/ -> publish/dysearch-<version>-store.zip
// Entries always use "/" separators and manifest.json sits at the archive root.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import path from "node:path";

const SRC = "dist";
const version = JSON.parse(readFileSync(path.join(SRC, "manifest.json"), "utf8")).version;
const OUT = path.join("publish", `dysearch-${version}-store.zip`);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const files = [];
(function walk(dir, base) {
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(full).isDirectory()) walk(full, rel);
    else files.push({ full, rel });
  }
})(SRC, "");

const chunks = [];
const central = [];
let offset = 0;

for (const { full, rel } of files) {
  const data = readFileSync(full);
  const comp = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const nameBuf = Buffer.from(rel, "utf8");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0x2122, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  chunks.push(local, nameBuf, comp);

  const head = Buffer.alloc(46);
  head.writeUInt32LE(0x02014b50, 0);
  head.writeUInt16LE(20, 4);
  head.writeUInt16LE(20, 6);
  head.writeUInt16LE(0, 8);
  head.writeUInt16LE(8, 10);
  head.writeUInt16LE(0, 12);
  head.writeUInt16LE(0x2122, 14);
  head.writeUInt32LE(crc, 16);
  head.writeUInt32LE(comp.length, 20);
  head.writeUInt32LE(data.length, 24);
  head.writeUInt16LE(nameBuf.length, 28);
  head.writeUInt32LE(offset, 42);
  central.push(Buffer.concat([head, nameBuf]));

  offset += local.length + nameBuf.length + comp.length;
}

const centralBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);

mkdirSync("publish", { recursive: true });
writeFileSync(OUT, Buffer.concat([...chunks, centralBuf, end]));
console.log(`[zip] ${OUT} files=${files.length} bytes=${statSync(OUT).size}`);
