import fs from 'node:fs';
import path from 'node:path';

const secretFile = process.env.PRIVATE_SHUFFLE_SECRET_FILE || './private/shuffle-secret.json';
const imageCid = process.env.REVEAL_IMAGES_CID || 'REPLACE_IMAGES_CID';
const outDir = path.resolve(process.env.REVEAL_METADATA_DIR || './private/revealed-metadata');
const sourceDir = path.resolve('collection/source-metadata');
const secret = JSON.parse(fs.readFileSync(path.resolve(secretFile),'utf8'));
const map = secret.map;
if (!secret.seed || !map || Object.keys(map).length !== 1111) throw new Error('Invalid shuffle secret');
const seen=new Set();
for(let i=1;i<=1111;i++){
  const artId=Number(map[String(i)]);
  if(!Number.isInteger(artId)||artId<1||artId>1111||seen.has(artId)) throw new Error(`Invalid permutation at token ${i}`);
  seen.add(artId);
}
fs.rmSync(outDir,{recursive:true,force:true}); fs.mkdirSync(outDir,{recursive:true});
for(let tokenId=1;tokenId<=1111;tokenId++){
  const artId=Number(map[String(tokenId)]);
  const source=JSON.parse(fs.readFileSync(path.join(sourceDir,`${artId}.json`),'utf8'));
  source.name=`UNKNOWN #${tokenId}`;
  source.description='UNKNOWN: 1111 anonymous operators, mined on Ethereum. Proof-of-work minted. Revealed collection artwork.';
  source.image=`ipfs://${imageCid}/${artId}.png`;
  source.attributes=[...source.attributes,{trait_type:'Art ID',value:artId,display_type:'number'}];
  fs.writeFileSync(path.join(outDir,`${tokenId}.json`), JSON.stringify(source,null,2)+'\n');
}
fs.writeFileSync(path.join(outDir,'_reveal-manifest.json'), JSON.stringify({name:'UNKNOWN',maxSupply:1111,seedCommitment:secret.seed, mapping:'private shuffle map',imagesCid:imageCid},null,2)+'\n');
console.log(`Built 1111 reveal metadata files in ${outDir}`);
