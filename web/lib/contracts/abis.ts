// web/lib/contracts/abis.ts

// INFT Contract ABI - Full version with ERC721Enumerable
export const INFT_ABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "name", "type": "string"},
      {"internalType": "string", "name": "symbol", "type": "string"},
      {"internalType": "address", "name": "_oracle", "type": "address"}
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"indexed": true, "internalType": "uint256", "name": "newTokenId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "owner", "type": "address"}
    ],
    "name": "AgentCloned",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "owner", "type": "address"},
      {"indexed": false, "internalType": "string", "name": "encryptedURI", "type": "string"}
    ],
    "name": "AgentMinted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"indexed": false, "internalType": "bytes32", "name": "newHash", "type": "bytes32"}
    ],
    "name": "MetadataUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "from", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "to", "type": "address"}
    ],
    "name": "TransferWithMetadata",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "executor", "type": "address"}
    ],
    "name": "UsageAuthorized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "executor", "type": "address"}
    ],
    "name": "UsageRevoked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "previousOwner", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "newOwner", "type": "address"}
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": false, "internalType": "address", "name": "account", "type": "address"}
    ],
    "name": "Paused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": false, "internalType": "address", "name": "account", "type": "address"}
    ],
    "name": "Unpaused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "from", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "to", "type": "address"},
      {"indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256"}
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "owner", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "approved", "type": "address"},
      {"indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256"}
    ],
    "name": "Approval",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "owner", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "operator", "type": "address"},
      {"indexed": false, "internalType": "bool", "name": "approved", "type": "bool"}
    ],
    "name": "ApprovalForAll",
    "type": "event"
  },
  // View Functions
  {
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "owner", "type": "address"},
      {"internalType": "uint256", "name": "index", "type": "uint256"}
    ],
    "name": "tokenOfOwnerByIndex",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "index", "type": "uint256"}],
    "name": "tokenByIndex",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "ownerOf",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "tokenURI",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "getMetadataHash",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "getEncryptedURI",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"internalType": "address", "name": "executor", "type": "address"}
    ],
    "name": "isAuthorized",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"internalType": "address", "name": "executor", "type": "address"}
    ],
    "name": "getAuthorization",
    "outputs": [{"internalType": "bytes", "name": "", "type": "bytes"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"internalType": "address", "name": "user", "type": "address"}
    ],
    "name": "getSealedKey",
    "outputs": [{"internalType": "bytes", "name": "", "type": "bytes"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "oracle",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  // State-changing functions
  {
    "inputs": [
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "string", "name": "encryptedURI", "type": "string"},
      {"internalType": "bytes32", "name": "metadataHash", "type": "bytes32"}
    ],
    "name": "mint",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "from", "type": "address"},
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"internalType": "bytes", "name": "sealedKey", "type": "bytes"},
      {"internalType": "bytes", "name": "proof", "type": "bytes"}
    ],
    "name": "transferWithMetadata",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "bytes", "name": "sealedKey", "type": "bytes"},
      {"internalType": "bytes", "name": "proof", "type": "bytes"}
    ],
    "name": "clone",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"internalType": "address", "name": "executor", "type": "address"},
      {"internalType": "bytes", "name": "permissions", "type": "bytes"}
    ],
    "name": "authorizeUsage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"internalType": "address", "name": "executor", "type": "address"}
    ],
    "name": "revokeUsage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "newOracle", "type": "address"}],
    "name": "updateOracle",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "newOwner", "type": "address"}],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Standard ERC721 functions
  {
    "inputs": [
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "owner", "type": "address"},
      {"internalType": "address", "name": "operator", "type": "address"}
    ],
    "name": "isApprovedForAll",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "operator", "type": "address"},
      {"internalType": "bool", "name": "approved", "type": "bool"}
    ],
    "name": "setApprovalForAll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "from", "type": "address"},
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"}
    ],
    "name": "transferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "from", "type": "address"},
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"}
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "from", "type": "address"},
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"internalType": "bytes", "name": "data", "type": "bytes"}
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "getApproved",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes4", "name": "interfaceId", "type": "bytes4"}],
    "name": "supportsInterface",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "bytes32", "name": "newMetadataHash", "type": "bytes32" },
      { "internalType": "bytes32", "name": "encryptionKey", "type": "bytes32" },
      { "internalType": "bytes32", "name": "decryptionKeyHash", "type": "bytes32" }
    ],
    "name": "clone",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "from", "type": "address" },
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "bytes32", "name": "newMetadataHash", "type": "bytes32" },
      { "internalType": "bytes", "name": "encryptedKey", "type": "bytes" },
      { "internalType": "bytes", "name": "proof", "type": "bytes" }
    ],
    "name": "transferWithMetadata",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// AgentMarketplace ABI

export const AGENT_MARKETPLACE_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "nftContract", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "uint256", "name": "price", "type": "uint256" }
    ],
    "name": "listItem",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "nftContract", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "buyItem",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "nftContract", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "cancelListing",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    
  "inputs": [
    { "internalType": "address", "name": "nftContract", "type": "address" },
    { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
  ],
  "name": "getListing",
  "outputs": [
    {
      "components": [
        { "internalType": "address", "name": "seller", "type": "address" },
        { "internalType": "uint256", "name": "price", "type": "uint256" },
        { "internalType": "bool", "name": "isActive", "type": "bool" },
        { "internalType": "uint256", "name": "listedAt", "type": "uint256" }
      ],
      "internalType": "struct AgentMarketplace.Listing",
      "name": "",
      "type": "tuple"
    }
  ],
  "stateMutability": "view",
  "type": "function"
},
  {
    "inputs": [],
    "name": "listingCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "seller", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "nftContract", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" }
    ],
    "name": "ItemListed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "buyer", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "nftContract", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" }
    ],
    "name": "ItemBought",
    "type": "event"
  },
{
  "anonymous": false,
  "inputs": [
    { "indexed": true, "internalType": "address", "name": "seller", "type": "address" },
    { "indexed": true, "internalType": "address", "name": "nftContract", "type": "address" },
    { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }
  ],
  "name": "ItemCanceled",
  "type": "event"
},  // ← ДОБАВЬТЕ ЭТУ ЗАПЯТУЮ!
{
  "inputs": [
    { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
  ],
  "name": "simplePurchase",
  "outputs": [],
  "stateMutability": "payable",
  "type": "function"
}
] as const

// MockOracle ABI
export const ORACLE_ABI = [
  {
    "inputs": [{"internalType": "bytes", "name": "", "type": "bytes"}],
    "name": "verifyProof",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes", "name": "", "type": "bytes"},
      {"internalType": "address", "name": "", "type": "address"}
    ],
    "name": "verifySealedKey",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "oldHash", "type": "bytes32"},
      {"internalType": "bytes32", "name": "newHash", "type": "bytes32"},
      {"internalType": "address", "name": "recipient", "type": "address"}
    ],
    "name": "generateProof",
    "outputs": [{"internalType": "bytes", "name": "", "type": "bytes"}],
    "stateMutability": "pure",
    "type": "function"
  }
] as const;
export const COMPUTE_ORACLE_ABI = [
  {
    "inputs": [
      { "internalType": "bytes32", "name": "datasetRoot", "type": "bytes32" },
      { "internalType": "string", "name": "baseModel", "type": "string" },
      { "internalType": "uint256", "name": "steps", "type": "uint256" },
      { "internalType": "uint256", "name": "lr", "type": "uint256" }
    ],
    "name": "requestJob",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "jobId", "type": "bytes32" },
      { "internalType": "bytes32", "name": "resultRoot", "type": "bytes32" }
    ],
    "name": "completeJob",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "jobId", "type": "bytes32" }],
    "name": "getJobStatus",
    "outputs": [
      { "internalType": "uint8", "name": "status", "type": "uint8" },
      { "internalType": "bytes32", "name": "resultRoot", "type": "bytes32" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Добавляем Fine-tuning Serving ABI
export const FINE_TUNING_SERVING_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "address", "name": "provider", "type": "address"}
    ],
    "name": "AccountExists",
    "type": "error"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "address", "name": "provider", "type": "address"}
    ],
    "name": "AccountNotExists", 
    "type": "error"
  },
  {
    "inputs": [
      {"internalType": "string", "name": "reason", "type": "string"}
    ],
    "name": "InvalidVerifierInput",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "provider", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "pendingRefund", "type": "uint256"}
    ],
    "name": "BalanceUpdated",
    "type": "event"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "address", "name": "provider", "type": "address"}
    ],
    "name": "accountExists",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "provider", "type": "address"},
      {"internalType": "uint256", "name": "index", "type": "uint256"}
    ],
    "name": "acknowledgeDeliverable",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "provider", "type": "address"},
      {"internalType": "address", "name": "providerSigner", "type": "address"}
    ],
    "name": "acknowledgeProviderSigner",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "address", "name": "provider", "type": "address"},
      {"internalType": "string", "name": "additionalInfo", "type": "string"}
    ],
    "name": "addAccount",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "bytes", "name": "modelRootHash", "type": "bytes"}
    ],
    "name": "addDeliverable",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "address", "name": "provider", "type": "address"},
      {"internalType": "uint256", "name": "cancelRetrievingAmount", "type": "uint256"}
    ],
    "name": "depositFund",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "address", "name": "provider", "type": "address"}
    ],
    "name": "getAccount",
    "outputs": [
      {
        "components": [
          {"internalType": "address", "name": "user", "type": "address"},
          {"internalType": "address", "name": "provider", "type": "address"},
          {"internalType": "uint256", "name": "nonce", "type": "uint256"},
          {"internalType": "uint256", "name": "balance", "type": "uint256"},
          {"internalType": "uint256", "name": "pendingRefund", "type": "uint256"},
          {
            "components": [
              {"internalType": "uint256", "name": "index", "type": "uint256"},
              {"internalType": "uint256", "name": "amount", "type": "uint256"},
              {"internalType": "uint256", "name": "createdAt", "type": "uint256"},
              {"internalType": "bool", "name": "processed", "type": "bool"}
            ],
            "internalType": "struct Refund[]",
            "name": "refunds",
            "type": "tuple[]"
          },
          {"internalType": "string", "name": "additionalInfo", "type": "string"},
          {"internalType": "address", "name": "providerSigner", "type": "address"},
          {
            "components": [
              {"internalType": "bytes", "name": "modelRootHash", "type": "bytes"},
              {"internalType": "bytes", "name": "encryptedSecret", "type": "bytes"},
              {"internalType": "bool", "name": "acknowledged", "type": "bool"}
            ],
            "internalType": "struct Deliverable[]",
            "name": "deliverables",
            "type": "tuple[]"
          }
        ],
        "internalType": "struct Account",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "address", "name": "provider", "type": "address"}
    ],
    "name": "getPendingRefund",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "address", "name": "provider", "type": "address"}
    ],
    "name": "requestRefundAll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const
