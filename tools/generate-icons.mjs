import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import STUDIO_MARK from '../src/lib/studio-mark.json' with { type: 'json' };

const palette = JSON.parse(await readFile(new URL('../src/lib/palette.json', import.meta.url), 'utf8'));
const rules = (values) => Object.entries(values).map(([key,value]) => `  --${key}: ${value};`).join('\n');
await writeFile(new URL('../src/app/palette.css', import.meta.url), `/* Generated from src/lib/palette.json. */\n:root {\n${rules(palette.light)}\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n${rules(palette.dark)}\n  }\n}\n`);
const background = palette.dark.paper, foreground = palette.dark.ink;
function svg(maskable = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${STUDIO_MARK.viewBox}" width="512" height="512"><rect width="64" height="64" rx="${maskable ? 0 : 14}" fill="${background}"/><g transform="translate(32 32) scale(${maskable ? 0.7 : 0.8}) translate(-32 -32)" fill="none" stroke="${foreground}" stroke-width="${STUDIO_MARK.stroke}" stroke-linecap="round" stroke-linejoin="round">${STUDIO_MARK.paths.map(d => `<path d="${d}"/>`).join('')}</g></svg>`;
}
const root = new URL('../public/', import.meta.url);
await writeFile(new URL('icon.svg', root), svg());
await writeFile(new URL('icon-maskable.svg', root), svg(true));
for (const [name, size, maskable] of [['icon-192.png',192,false],['icon-512.png',512,false],['apple-touch-icon.png',180,true],['icon-maskable-512.png',512,true]]) {
  await sharp(Buffer.from(svg(maskable))).resize(size,size).png().toFile(new URL(name, root).pathname);
}
const images = await Promise.all([16,32,48].map(size => sharp(Buffer.from(svg())).resize(size,size).png().toBuffer()));
const header = Buffer.alloc(6 + images.length * 16);
header.writeUInt16LE(1,2); header.writeUInt16LE(images.length,4);
let offset = header.length;
images.forEach((bytes,index) => {
  const size = [16,32,48][index], at = 6+index*16;
  header[at] = size; header[at+1] = size; header.writeUInt16LE(1,at+4); header.writeUInt16LE(32,at+6);
  header.writeUInt32LE(bytes.length,at+8); header.writeUInt32LE(offset,at+12); offset += bytes.length;
});
await writeFile(new URL('favicon.ico', root), Buffer.concat([header,...images]));
console.log('Generated studio SVG, Apple, manifest, maskable and favicon assets.');
