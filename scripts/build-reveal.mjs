import fs from 'node:fs';
import path from 'node:path';

const imageCid = process.env.REVEAL_IMAGES_CID || 'REPLACE_IMAGES_CID';
const outDir = path.resolve(process.env.REVEAL_METADATA_DIR || './private/revealed-metadata');
const sourceDir = path.resolve('collection/source-metadata');

if (!imageCid || imageCid === 'REPLACE_IMAGES_CID') throw new Error('Set REVEAL_IMAGES_CID to the CID containing 1.png ... 1111.png');

fs.rmSync(outDir,{recursive:true,force:true});
fs.mkdirSync(outDir,{recursive:true});

for (let artId=1; artId<=1111; artId++) {
  const source = JSON.parse(fs.readFileSync(path.join(sourceDir, `${artId}.json`), 'utf8'));
  source.name = `UNKNOWN ART #${artId}`;
  source.description = 'UNKNOWN: 1111 anonymous operators, mined on Ethereum. Proof-of-work minted. Artwork is revealed immediately when each token is mined.';
  source.image = `ipfs://${imageCid}/${artId}.png`;
  source.attributes = [...(source.attributes || []), {trait_type:'Art ID', value:artId, display_type:'number'}];
  fs.writeFileSync(path.join(outDir, `${artId}.json`), JSON.stringify(source,null,2)+'\n');
}

fs.writeFileSync(path.join(outDir,'_metadata-manifest.json'), JSON.stringify({
  name:'UNKNOWN',
  maxSupply:1111,
  mapping:'on-chain draw without replacement',
  imagesCid:imageCid
},null,2)+'\n');

console.log(`Built 1111 reveal metadata files in ${outDir}`);
