import fs from 'node:fs';
const config={
  chainId:Number(process.env.CHAIN_ID||1),
  nftAddress:process.env.CONTRACT_ADDRESS||'',
  imdAddress:process.env.IMD_TOKEN_ADDRESS||'',
  imdDecimals:Number(process.env.IMD_DECIMALS||18),
  explorer:process.env.EXPLORER_URL||(Number(process.env.CHAIN_ID||1)===1?'https://etherscan.io':'https://sepolia.etherscan.io')
};
if(!/^0x[a-fA-F0-9]{40}$/.test(config.nftAddress)||!/^0x[a-fA-F0-9]{40}$/.test(config.imdAddress)) throw new Error('Set valid CONTRACT_ADDRESS and IMD_TOKEN_ADDRESS');
fs.writeFileSync('apps/web/config.js','window.UNKNOWN_CONFIG = '+JSON.stringify(config,null,2)+';\n');
console.log('Wrote apps/web/config.js');
