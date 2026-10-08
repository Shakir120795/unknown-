import fs from 'node:fs';
import path from 'node:path';
const out=path.resolve(process.env.HIDDEN_METADATA_DIR||'./collection/hidden-metadata');
const placeholderCid=process.env.PLACEHOLDER_CID||'REPLACE_PLACEHOLDER_CID';
fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out,{recursive:true});
for(let id=1;id<=1111;id++){
  fs.writeFileSync(path.join(out,`${id}.json`), JSON.stringify({name:`UNKNOWN #${id}`,description:'UNKNOWN: Proof-of-work NFT. Artwork remains hidden until the 1,111 NFT collection is fully mined.',image:`ipfs://${placeholderCid}/placeholder.png`,attributes:[{trait_type:'Status',value:'Unrevealed'}]},null,2)+'\n');
}
console.log(`Built 1111 hidden metadata files in ${out}`);
