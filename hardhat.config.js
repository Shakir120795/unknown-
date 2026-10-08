import '@nomicfoundation/hardhat-toolbox';

export default {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    hardhat: { chainId: 31337 },
    sepolia: {
      url: process.env.RPC_URL || '',
      chainId: 11155111,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    },
    mainnet: {
      url: process.env.RPC_URL || '',
      chainId: 1,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    }
  }
};
