require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000000";
const OG_RPC_URL = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";

/** @type import('hardhat/config').HardhatUserConfig */
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
      url: OG_RPC_URL,
      chainId: 16601,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
      gas: "auto",
      timeout: 120000 // 2 minutes timeout
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  },
  etherscan: {
    apiKey: {
      "0g-testnet": "no-api-key-needed" // 0G testnet doesn't require API key
    },
    customChains: [
      {
        network: "0g-testnet",
        chainId: 16601,
        urls: {
          apiURL: "https://chainscan-api-galileo.0g.ai/api",
          browserURL: "https://chainscan-galileo.0g.ai"
        }
      }
    ]
  },
  sourcify: {
    enabled: false
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD"
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 120000 // 2 minutes timeout for tests
  }
};