import { expect } from 'chai';
import hre from 'hardhat';
import { proofHash, validDifficulty } from '../packages/mining/crypto.mjs';

const { ethers, network } = hre;

const PROD_PRICES = [
  ethers.parseEther('0.2'), ethers.parseEther('0.5'), ethers.parseEther('0.8'),
  ethers.parseEther('1.1'), ethers.parseEther('1.5'), ethers.parseEther('2.0')
];
const PROD_DIFF = [16,18,20,22,24,26];

async function findNonce({chainId, contract, challenge, seedBlock, tokenId, wallet, difficultyBits}) {
  let nonce = 0n;
  while (true) {
    const hash = proofHash({chainId, contractAddress:contract, challenge, seedBlock, tokenId, wallet, nonce});
    if (validDifficulty(hash, difficultyBits)) return {nonce, hash};
    nonce++;
  }
}

async function setup(diffs=PROD_DIFF) {
  const [owner, user, treasury, other] = await ethers.getSigners();
  const MockIMD = await ethers.getContractFactory('MockIMD');
  const imd = await MockIMD.deploy();
  const NFT = await ethers.getContractFactory('UnknownMining');
  const provenance='0x'+'11'.repeat(32);
  const nft = await NFT.deploy(
    await imd.getAddress(), treasury.address,
    'ipfs://hidden/', 'ipfs://revealed/', provenance, PROD_PRICES, diffs
  );
  await imd.mint(user.address, ethers.parseEther('10000'));
  await imd.connect(user).approve(await nft.getAddress(), ethers.parseEther('10000'));
  return {owner,user,treasury,other,imd,nft,provenance};
}

async function currentSolution(ctx) {
  const work=await ctx.nft.currentWork();
  const chainId=Number((await ethers.provider.getNetwork()).chainId);
  const contract=await ctx.nft.getAddress();
  return {work, chainId, contract, ...(await findNonce({
    chainId, contract, challenge:work[1], seedBlock:work[0], tokenId:work[2], wallet:ctx.user.address, difficultyBits:Number(work[5])
  }))};
}

describe('UnknownMining', function () {
  it('stores production phases, price schedule and increasing difficulty', async function () {
    const c=await setup();
    expect(await c.nft.MAX_SUPPLY()).to.equal(1111n);
    for(let i=0;i<6;i++){
      expect(await c.nft.phasePrice(i+1)).to.equal(PROD_PRICES[i]);
      expect(await c.nft.phaseDifficultyBits(i+1)).to.equal(PROD_DIFF[i]);
    }
    expect(await c.nft.provenanceHash()).to.equal(c.provenance);
  });

  it('verifies the exact browser/Node SHA-256 proof and mints directly on-chain', async function () {
    const c=await setup();
    const s=await currentSolution(c);
    expect(await c.nft.powHash(c.user.address,s.work[2],s.work[0],s.nonce)).to.equal('0x'+s.hash);
    expect(await c.nft.isValidProof(c.user.address,s.work[2],s.work[0],s.nonce)).to.equal(true);
    const before=await c.imd.balanceOf(c.treasury.address);
    await expect(c.nft.connect(c.user).mint(s.work[0],s.nonce)).to.emit(c.nft,'Minted');
    expect(await c.nft.totalMinted()).to.equal(1n);
    expect(await c.nft.ownerOf(1)).to.equal(c.user.address);
    expect(await c.imd.balanceOf(c.treasury.address)).to.equal(before+PROD_PRICES[0]);
  });

  it('rejects a bad proof and a stale challenge', async function () {
    const c=await setup();
    const s=await currentSolution(c);
    await expect(c.nft.connect(c.user).mint(s.work[0], s.nonce+1n)).to.be.reverted;
    for(let i=0;i<33;i++) await network.provider.send('evm_mine');
    await expect(c.nft.connect(c.user).mint(s.work[0], s.nonce)).to.be.reverted;
  });

  it('keeps token IDs sequential and binds proof to the current next token', async function () {
    const c=await setup();
    const s=await currentSolution(c);
    expect(await c.nft.isValidProof(c.user.address,2,s.work[0],s.nonce)).to.equal(false);
    await c.nft.connect(c.user).mint(s.work[0],s.nonce);
    expect(await c.nft.totalMinted()).to.equal(1n);
  });

  it('pause blocks minting and unpause restores minting', async function () {
    const c=await setup();
    await c.nft.pause();
    const s=await currentSolution(c);
    await expect(c.nft.connect(c.user).mint(s.work[0],s.nonce)).to.be.reverted;
    await c.nft.unpause();
    const s2=await currentSolution(c);
    await c.nft.connect(c.user).mint(s2.work[0],s2.nonce);
    expect(await c.nft.totalMinted()).to.equal(1n);
  });

  it('uses hidden metadata before sellout and permissionless reveal after sellout', async function () {
    const c=await setup([1,2,3,4,5,6]);
    await expect(c.nft.reveal()).to.be.reverted;
    for(let i=0;i<1111;i++){
      const s=await currentSolution(c);
      await c.nft.connect(c.user).mint(s.work[0],s.nonce);
    }
    expect(await c.nft.totalMinted()).to.equal(1111n);
    expect(await c.nft.tokenURI(1)).to.equal('ipfs://hidden/1.json');
    await c.nft.connect(c.other).reveal();
    expect(await c.nft.revealed()).to.equal(true);
    expect(await c.nft.tokenURI(1)).to.equal('ipfs://revealed/1.json');
    await expect(c.nft.reveal()).to.be.reverted;
  });
});
