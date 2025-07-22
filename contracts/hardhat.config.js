require("dotenv").config();

// Îעהוכüםûו טלןמנעû גלוסעמ toolbox
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");

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
      accounts: [PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: {
      "0g-testnet": "no-api-key-needed"
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
  }
};