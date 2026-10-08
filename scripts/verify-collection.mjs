import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve('collection');
const images = path.join(root, 'images');
const hd = path.join(root, 'images_hd');
const meta = path.join(root, 'source-metadata');
const prov = JSON.parse(fs.readFileSync(path.join(root, 'provenance.json'), 'utf8'));

function files(dir) { return fs.readdirSync(dir).filter(f => f.endsWith('.png') || f.endsWith('.json')); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function pngInfo(file) {
  const b=fs.readFileSync(file);
  assert(b.length>=26 && b.readUInt32BE(0)===0x89504e47 && b.toString('ascii',1,4)==='PNG',`invalid PNG ${file}`);
  return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),bitDepth:b[24],colorType:b[25]};
}
const ids = Array.from({length:1111}, (_,i)=>i+1);
assert(files(images).length === 1111, 'images must contain exactly 1111 PNGs');
assert(files(hd).length === 1111, 'images_hd must contain exactly 1111 PNGs');
assert(files(meta).length === 1111, 'source-metadata must contain exactly 1111 JSONs');
for (const id of ids) {
  const imagePath=path.join(images, `${id}.png`); const hdPath=path.join(hd, `${id}.png`);
  assert(fs.existsSync(imagePath), `missing image ${id}.png`);
  assert(fs.existsSync(hdPath), `missing HD image ${id}.png`);
  const a=pngInfo(imagePath), b=pngInfo(hdPath);
  assert(a.width===64 && a.height===64 && a.bitDepth===8 && a.colorType===6, `invalid source PNG ${id}.png`);
  assert(b.width===640 && b.height===640 && b.bitDepth===8 && b.colorType===6, `invalid HD PNG ${id}.png`);
  const m=JSON.parse(fs.readFileSync(path.join(meta, `${id}.json`), 'utf8'));
  assert(m.name === `UNKNOWN #${id}`, `metadata name mismatch ${id}`);
  assert(Array.isArray(m.attributes), `missing attributes ${id}`);
}
const digests=[];
for (const id of ids) digests.push(crypto.createHash('sha256').update(fs.readFileSync(path.join(images, `${id}.png`))).digest());
const actual='0x'+crypto.createHash('sha256').update(Buffer.concat(digests)).digest('hex');
assert(actual.toLowerCase()===String(prov.provenanceHash).toLowerCase(), `provenance mismatch: ${actual}`);
const manifest = {
  name:'UNKNOWN', maxSupply:1111, ids:'1-1111', chain:'Ethereum', payment:'IMD',
  imageSize:'64x64 RGBA PNG', displayImageSize:'640x640 RGBA PNG',
  provenanceHash:actual, artworkSource:'user-provided collection',
  privateShuffleSecret:'NOT_INCLUDED',
  publicAssets:{images:'./images', images_hd:'./images_hd', sourceMetadata:'./source-metadata'},
  hiddenAssets:{placeholder:'./hidden/placeholder.png'}
};
fs.writeFileSync(path.join(root,'manifest.json'), JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({ok:true, images:1111, metadata:1111, provenanceHash:actual},null,2));
