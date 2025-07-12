export const INFT_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "encryptedURI", type: "string" },
      { name: "metadataHash", type: "bytes32" }
    ],
    name: "mint",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "sealedKey", type: "bytes" },
      { name: "proof", type: "bytes" }
    ],
    name: "secureTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "executor", type: "address" },
      { name: "permissions", type: "bytes" }
    ],
    name: "authorizeUsage",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getEncryptedURI",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getMetadataHash",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: true, name: "owner", type: "address" },
      { indexed: false, name: "encryptedURI", type: "string" }
    ],
    name: "AgentMinted",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" }
    ],
    name: "TransferCompleted",
    type: "event"
  }
] as const

export const MARKETPLACE_ABI = [
  {
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" }
    ],
    name: "listAgent",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "buyerPublicKey", type: "bytes" }
    ],
    name: "purchaseAgent",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "cancelListing",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getListing",
    outputs: [
      { name: "seller", type: "address" },
      { name: "price", type: "uint256" },
      { name: "isActive", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const

// ===================================