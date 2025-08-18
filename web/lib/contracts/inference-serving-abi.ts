// 0G Inference Serving Contract ABI - Updated to match SDK structure
// Based on the deployed contract at 0x5299bd255B76305ae08d7F95B270A485c6b95D54
// Updated to match 0g-serving-user-broker SDK ServiceStruct

export const INFERENCE_SERVING_ABI = [
  // Service management
  {
    "inputs": [],
    "name": "getAllServices",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "provider", "type": "address" },
          { "internalType": "string", "name": "serviceType", "type": "string" },
          { "internalType": "string", "name": "url", "type": "string" },
          { "internalType": "uint256", "name": "inputPrice", "type": "uint256" },
          { "internalType": "uint256", "name": "outputPrice", "type": "uint256" },
          { "internalType": "uint256", "name": "updatedAt", "type": "uint256" },
          { "internalType": "string", "name": "model", "type": "string" },
          { "internalType": "string", "name": "verifiability", "type": "string" },
          { "internalType": "string", "name": "additionalInfo", "type": "string" }
        ],
        "internalType": "struct InferenceServing.ServiceStruct[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "provider", "type": "address" }
    ],
    "name": "getService",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "provider", "type": "address" },
          { "internalType": "string", "name": "serviceType", "type": "string" },
          { "internalType": "string", "name": "url", "type": "string" },
          { "internalType": "uint256", "name": "inputPrice", "type": "uint256" },
          { "internalType": "uint256", "name": "outputPrice", "type": "uint256" },
          { "internalType": "uint256", "name": "updatedAt", "type": "uint256" },
          { "internalType": "string", "name": "model", "type": "string" },
          { "internalType": "string", "name": "verifiability", "type": "string" }
        ],
        "internalType": "struct InferenceServing.ServiceStruct",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Service registration (provider only)
  {
    "inputs": [
      { "internalType": "string", "name": "serviceType", "type": "string" },
      { "internalType": "string", "name": "url", "type": "string" },
      { "internalType": "string", "name": "model", "type": "string" },
      { "internalType": "string", "name": "verifiability", "type": "string" },
      { "internalType": "uint256", "name": "inputPrice", "type": "uint256" },
      { "internalType": "uint256", "name": "outputPrice", "type": "uint256" },
      { "internalType": "string", "name": "additionalInfo", "type": "string" }
    ],
    "name": "addService",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "removeService",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Account management  
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "address", "name": "provider", "type": "address" }
    ],
    "name": "getAccount",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "user", "type": "address" },
          { "internalType": "address", "name": "provider", "type": "address" },
          { "internalType": "uint256", "name": "nonce", "type": "uint256" },
          { "internalType": "uint256", "name": "balance", "type": "uint256" },
          { "internalType": "uint256", "name": "pendingRefund", "type": "uint256" },
          { "internalType": "uint256[2]", "name": "signer", "type": "uint256[2]" },
          {
            "components": [
              { "internalType": "uint256", "name": "index", "type": "uint256" },
              { "internalType": "uint256", "name": "amount", "type": "uint256" },
              { "internalType": "uint256", "name": "createdAt", "type": "uint256" },
              { "internalType": "bool", "name": "processed", "type": "bool" }
            ],
            "internalType": "struct InferenceServing.RefundStruct[]",
            "name": "refunds",
            "type": "tuple[]"
          },
          { "internalType": "string", "name": "additionalInfo", "type": "string" },
          { "internalType": "uint256[2]", "name": "providerPubKey", "type": "uint256[2]" }
        ],
        "internalType": "struct InferenceServing.AccountStruct",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllAccounts",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "user", "type": "address" },
          { "internalType": "address", "name": "provider", "type": "address" },
          { "internalType": "uint256", "name": "nonce", "type": "uint256" },
          { "internalType": "uint256", "name": "balance", "type": "uint256" },
          { "internalType": "uint256", "name": "pendingRefund", "type": "uint256" },
          { "internalType": "uint256[2]", "name": "signer", "type": "uint256[2]" },
          {
            "components": [
              { "internalType": "uint256", "name": "index", "type": "uint256" },
              { "internalType": "uint256", "name": "amount", "type": "uint256" },
              { "internalType": "uint256", "name": "createdAt", "type": "uint256" },
              { "internalType": "bool", "name": "processed", "type": "bool" }
            ],
            "internalType": "struct InferenceServing.RefundStruct[]",
            "name": "refunds",
            "type": "tuple[]"
          },
          { "internalType": "string", "name": "additionalInfo", "type": "string" },
          { "internalType": "uint256[2]", "name": "providerPubKey", "type": "uint256[2]" }
        ],
        "internalType": "struct InferenceServing.AccountStruct[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Provider acknowledgment
  {
    "inputs": [
      { "internalType": "address", "name": "providerAddress", "type": "address" },
      { "internalType": "uint256[2]", "name": "providerSigner", "type": "uint256[2]" }
    ],
    "name": "acknowledgeProviderSigner",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;ts": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;