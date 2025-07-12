require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    "0g-testnet": {
      url: process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 16600
    }
  },
  etherscan: {
    apiKey: {
      "0g-testnet": "no-api-key-needed"
    },
    customChains: [
      {
        network: "0g-testnet",
        chainId: 16600,
        urls: {
          apiURL: "https://explorer-testnet.0g.ai/api",
          browserURL: "https://explorer-testnet.0g.ai"
        }
      }
    ]
  }
};
