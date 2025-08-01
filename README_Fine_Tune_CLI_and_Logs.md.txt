0g-ts-sdk
This is the JavaScript SDK for 0g-storage. Features include:

 File Merkle Tree Class
 Flow Contract Types
 RPC methods support
 File upload
 Support browser environment
 Tests for different environments
 File download
Install
npm install @0glabs/0g-ts-sdk ethers
ethers is a peer dependency of this project.

Usage
Node.js environment ESM example:
Use ZgFile to create a file object, then call merkleTree method to get the merkle tree of the file.

import { Indexer, ZgFile } from '@0glabs/0g-ts-sdk';
import { ethers } from 'ethers';
import { exit } from 'process';

const file = await ZgFile.fromFilePath(<file_path>);
var [tree, err] = await file.merkleTree();
if (err === null) {
  console.log("File Root Hash: ", tree.rootHash());
} else {
  exit(1);
}
await file.close();
Upload file to 0g-storage:

import { getFlowContract } from '@0glabs/0g-ts-sdk';
const evmRpc = 'https://evmrpc-testnet.0g.ai';
const privateKey = ''; // with balance to pay for gas
const indRpc = 'https://indexer-storage-testnet-turbo.0g.ai'; // indexer rpc

const provider = new ethers.JsonRpcProvider(evmRpc);
const signer = new ethers.Wallet(privateKey, provider);

const indexer = new Indexer(indRpc);
// need to pay fees to store data in storage nodes
var [tx, err] = await indexer.upload(file, evmRpc, signer);
if (err === null) {
  console.log("File uploaded successfully, tx: ", tx);
} else {
  console.log("Error uploading file: ", err);
}
Download file from 0g-storage

err = await indexer.download(<root_hash>, <output_file>, <with_proof>);
if (err !== null) {
  console.log("Error downloading file: ", err);
}
Upload data to 0g-kv:

var [nodes, err] = await indexer.selectNodes(1);
if (err !== null) {
    console.log("Error selecting nodes: ", err);
    stop();
}

const batcher = new Batcher(1, nodes, flowContract, evmRpc);

const key1 = Uint8Array.from(Buffer.from("TESTKEY0", 'utf-8'));
const val1 = Uint8Array.from(Buffer.from("TESTVALUE0", 'utf-8'));
const key2 = Uint8Array.from(Buffer.from("TESTKEY1", 'utf-8'));
const val2 = Uint8Array.from(Buffer.from("TESTVALUE1", 'utf-8'));
batcher.streamDataBuilder.set("0x...", key1, val1);
batcher.streamDataBuilder.set("0x...", key2, val2);

var [tx, err] = await batcher.exec();

if (err === null) {
    console.log("Batcher executed successfully, tx: ", tx);
} else {
    console.log("Error executing batcher: ", err);
}
Download data from 0g-kv

const KvClientAddr = "http://3.101.147.150:6789"

const streamId = "0x..."
const kvClient = new KvClient(KvClientAddr)

let val = await kvClient.getValue(streamId, ethers.encodeBase64(key1));
console.log(val)
Browser environment example:
Import zgstorage.esm.js in your html file:

<script type="module">
  import { Blob, Indexer } from "./dist/zgstorage.esm.js";
  // Your code here...
</script>
Create file object from blob:

const file = new Blob(blob);
const [tree, err] = await file.merkleTree();
if (err === null) {
  console.log("File Root Hash: ", tree.rootHash());
}
File upload is same with node.js environment with the following provider change

import { BrowserProvider } from 'ethers';  // or from ethers.js url

let provider = new BrowserProvider(window.ethereum) // metamask need to be installed
Vite example:
To use the SDK with Vite, set up polyfills in your vite.config.ts:

import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    ...
    nodePolyfills({
      include: ['crypto', 'buffer', 'stream', 'util', 'events'],
    }),
  ],
});
Now, you can import SDK files with the /browser suffix:

import { Indexer, Blob } from '@0glabs/0g-ts-sdk/browser';
Check codes in examples for more details.

Contribute
This project uses pnpm as package manager. After cloning the project, run pnpm install to install dependencies.

Generate Contract Flow Types
Make sure 0g-storage-contracts is in project sibling directory.

pnpm gen-contract-type-flow
pnpm gen-contract-type-market


0G Compute SDK
The 0G Compute Network SDK enables developers to integrate AI inference services from the 0G Compute Network into their applications. Currently, the 0G Compute Network SDK supports Large Language Model (LLM) inference services, with fine-tuning and additional features planned for future releases.

In just five minutes, you can initialize your broker to manage operations, set up and fund your account to pay for inference services, and learn how to send inference requests and handle responses.

Quick Start
Installation
pnpm add @0glabs/0g-serving-broker @types/crypto-js@4.2.2 crypto-js@4.2.0

Core Concepts
1. The Broker
Your interface to the 0G Compute Network:

Handles authentication and billing
Manages provider connections
Verifies computations
2. Providers
GPU owners offering AI services:

Each has a unique address
Set their own prices
Run specific models
3. Prepaid Accounts
Fund account before usage
Automatic micropayments
No surprise bills
Step-by-Step Guide
Initialize the Broker
Using Private Key
Browser Wallet
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";

const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const broker = await createZGComputeNetworkBroker(wallet);

Fund Your Account
// Add 0.1 OG tokens (~10,000 requests)
await broker.ledger.addLedger(ethers.parseEther("0.1"));

// Check balance
const account = await broker.ledger.getLedger();
console.log(`Balance: ${ethers.formatEther(account.balance)} OG`);

Discover Available Services
The 0G Compute Network hosts multiple AI service providers. The service discovery process helps you find and select the appropriate services for your needs.

🎯 Official 0G Services
Model	Provider Address	Description	Verification
llama-3.3-70b-instruct	0xf07240Efa67755B5311bc75784a061eDB47165Dd	State-of-the-art 70B parameter model for general AI tasks	TEE (TeeML)
deepseek-r1-70b	0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3	Advanced reasoning model optimized for complex problem solving	TEE (TeeML)
const services = await broker.inference.listService();

Each service contains the following information:

type ServiceStructOutput = {
  provider: string; // Provider's wallet address (unique identifier)
  serviceType: string; // Type of service
  url: string; // Service URL
  inputPrice: bigint; // Price for input processing
  outputPrice: bigint; // Price for output generation
  updatedAt: bigint; // Last update timestamp
  model: string; // Model identifier
  verifiability: string; // Indicates how the service's outputs can be verified. 'TeeML' means it runs with verification in a Trusted Execution Environment. An empty value means no verification.
};


Acknowledge Provider
Before using a service provided by a provider, you must first acknowledge the provider on-chain by following API:

await broker.inference.acknowledgeProviderSigner(providerAddress)

The providerAddress can be obtained from from service metadata. For details on how to retrieve it, see Discover Available Services

Service Requests
Service usage in the 0G Network involves two key steps:

Retrieving service metadata
Generating authenticated request headers
  
  // Get service details
  const { endpoint, model } = await broker.inference.getServiceMetadata(provider);
  
  // Generate auth headers (single use)
  const headers = await broker.inference.getRequestHeaders(provider, question);
  

Send a Request to the Service
Using Fetch API
Using OpenAI SDK
const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      messages: [{ role: "user", content: question }],
      model: model,
    }),
  });
  
const data = await response.json();
const answer = data.choices[0].message.content;


Response Processing
This function is used to verify the response. If it is a verifiable service, it will return whether the response is valid.

const valid = await broker.inference.processResponse(
  providerAddress,
  content,
  chatID // Optional: Only for verifiable services
);

Fee Settlement
Fee settlement by the broker service occurs at scheduled intervals.

Account Management
Check Balance
const ledger = await broker.ledger.getLedger();
console.log(`
  Balance: ${ethers.formatEther(ledger.balance)} OG
  Locked: ${ethers.formatEther(ledger.locked)} OG
  Available: ${ethers.formatEther(ledger.balance - ledger.locked)} OG
`);

Add Funds
// Add more funds
await broker.ledger.depositFund(ethers.parseEther("0.5"));

Request Refund
// Withdraw unused funds
const amount = ethers.parseEther("0.1");
await broker.ledger.retrieveFund("inference", amount);

Troubleshooting
Common Issues
Error: Insufficient balance
Your account doesn't have enough funds. Add more:

await broker.ledger.addLedger(ethers.parseEther("0.1"));

Error: Headers already used
Request headers are single-use. Generate new ones for each request:

// ❌ Wrong
const headers = await broker.inference.getRequestHeaders(provider, content);
await makeRequest(headers);
await makeRequest(headers); // Will fail!

// ✅ Correct
const headers1 = await broker.inference.getRequestHeaders(provider, content);
await makeRequest(headers1);
const headers2 = await broker.inference.getRequestHeaders(provider, content);
await makeRequest(headers2);

Error: Provider not responding
The provider might be offline. Try another:

// Try all official providers
for (const [model, provider] of Object.entries(OFFICIAL_PROVIDERS)) {
  try {
    console.log(`Trying ${model}...`);
    return await makeRequestToProvider(provider);
  } catch (e) {
    console.log(`${model} failed, trying next...`);
    continue; // Try next provider
  }
}

Next Steps
Fine-tuning CLI
Customize AI models with your own data using 0G's distributed GPU network.

Quick Start
Prerequisites
Node version >= 22.0.0

Install CLI
pnpm install @0glabs/0g-serving-broker -g

Set Environment
export RPC_ENDPOINT=https://evmrpc-testnet.0g.ai  # Optional, this is default
export ZG_PRIVATE_KEY=your_private_key_here

Create Account & Add Funds
The Fine-tuning CLI requires an account to pay for service fees via the 0G Compute Network. You can create an account with the following command:

# Create account with 0.1 OG
0g-compute-cli add-account --amount 0.1

List Providers
0g-compute-cli list-providers

The output will be like:

┌──────────────────────────────────────────────────┬──────────────────────────────────────────────────┐
│ Provider 1                                       │ 0xf07240Efa67755B5311bc75784a061eDB47165Dd       │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Available                                        │ ✓                                                │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Price Per Byte in Dataset (OG)                   │ 0.000000000000000001                             │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Provider 2                                       │ ......                                           │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ ......                                           │ ......                                           │
└──────────────────────────────────────────────────┴──────────────────────────────────────────────────┘

Provider x: The address of the provider. The address of the official provider is 0xf07240Efa67755B5311bc75784a061eDB47165Dd.
Available: Indicates if the provider is available. If ✓, the provider is available. If ✗, the provider is occupied.
Price Per Byte in Dataset (OG): The service fee charged by the provider. The fee is currently based on the byte count of the dataset. Future versions may charge more accurately based on the token count of the dataset.
List Models
# List available models
0g-compute-cli list-models

📋 Available Models Summary
The output consists of two main sections:

Predefined Models: These are models that are provided by the system as predefined options. They are typically built-in, curated, and maintained to ensure quality, reliability, and broad applicability across common use cases.

Provider's Model: These models are offered by external service providers. Providers may customize or fine-tune models to address specific needs, industries, or advanced use cases. The availability and quality of these models may vary depending on the provider.

Note: We currently offer the models listed above as presets. You can choose one of these models for fine-tuning. More models will be provided in future versions.

Prepare Configuration File
Please download the parameter file template for the model you wish to fine-tune from the releases page and modify it according to your needs.

Note: For custom models provided by third-party Providers, you can download the usage template including instructions on how to construct the dataset and training configuration using the following command:

0g-compute-cli model-usage --provider <PROVIDER_ADDRESS>  --model <MODEL_NAME>   --output <PATH_TO_SAVE_MODEL_USAGE>


Prepare Your Data
Please download the dataset format specification and verification script from the releases page to make sure your generated dataset complies with the requirements.

Upload Dataset
# Upload to 0G Storage
0g-compute-cli upload --data-path <PATH_TO_DATASET>

# Output: Root hash: 0xabc123... (save this!)

Record the root hash of the dataset; they will be needed in later steps.

Calculate Dataset Size
After uploading the dataset to storage, you can calculate its size by running the following command:

0g-compute-cli calculate-token \
  --model <MODEL_NAME> \
  --dataset-path <PATH_TO_DATASET> \
  --provider <PROVIDER_ADDRESS>

Create Task
After calculating the dataset size, you can create a task by running the following command:

0g-compute-cli create-task \
  --provider <PROVIDER_ADDRESS> \
  --model <MODEL_NAME> \
  --dataset <DATASET_ROOT_HASH> \
  --config-path <PATH_TO_CONFIG_FILE> \
  --data-size <DATASET_SIZE>

Parameters:

Parameter	Description
--provider	Address of the service provider
--model	Name of the pretrained model
--dataset	Root hash of the dataset on 0G Storage
--config-path	Path to the parameter file
--data-size	Size of the dataset
--gas-price	Gas price (optional)
The output will be like:

Verify provider...
Provider verified
Creating task...
Created Task ID: 6b607314-88b0-4fef-91e7-43227a54de57

Note: When creating a task for the same provider, you must wait for the previous task to be completed (status Finished) before creating a new task. If the provider is currently running other tasks, you will be prompted to choose between adding your task to the waiting queue or canceling the request.

Monitor Progress
You can monitor the progress of your task by running the following command:

0g-compute-cli get-task --provider <PROVIDER_ADDRESS> --task <TASK_ID>

The output will be like:

┌───────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────┐
│ Field                             │ Value                                                                               │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ ID                                │ beb6f0d8-4660-4c62-988d-00246ce913d2                                                │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Created At                        │ 2025-03-11T01:20:07.644Z                                                            │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Pre-trained Model Hash            │ 0xcb42b5ca9e998c82dd239ef2d20d22a4ae16b3dc0ce0a855c93b52c7c2bab6dc                  │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Dataset Hash                      │ 0xaae9b4e031e06f84b20f10ec629f36c57719ea512992a6b7e2baea93f447a5fa                  │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Training Params                   │ {......}                                                                            │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Fee (neuron)                      │ 179668154                                                                           │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Progress                          │ Delivered                                                                           │
└───────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────┘


Field Descriptions:

ID: Unique identifier for your fine-tuning task
Pre-trained Model Hash: Storage reference for the base model being fine-tuned
Dataset Hash: Storage reference for your training dataset
Training Params: Configuration parameters used during fine-tuning
Fee (neuron): Total cost for the fine-tuning task
Progress: Task status. Possible values are Init, SettingUp, SetUp, Training, Trained, Delivering, Delivered, UserAcknowledged, Finished, Failed. These represent the following states, respectively:
Init: Task submitted
SettingUp: Provider is preparing the environment to run the task
SetUp: Provider is ready to start training the model
Training: Provider is training the model
Trained: provider has finished the training
Delivering: Provider is uploading the fine-tuning result to storage
Delivered: provider has uploaded the fine-tuning result
UserAcknowledged: User has confirmed the result is downloadable
Finished: Task is completed
Failed: Task failed
View Task Logs
You can view the logs of your task by running the following command:

0g-compute-cli get-log --provider <PROVIDER_ADDRESS> --task <TASK_ID>

The output will be like:

creating task....
Step: 0, Logs: {'loss': ..., 'accuracy': ...}
...
Training model for task beb6f0d8-4660-4c62-988d-00246ce913d2 completed successfully

Confirm Task Result
Use the Check Task command to view task status. When the status changes to Delivered, it indicates that the provider has completed the fine-tuning task and uploaded the result to storage. The corresponding root hash has also been saved to the contract. You can download the model with the following command; CLI will download the model based on the root hash submitted by the provider. If the download is successful, CLI updates the contract information to confirm the model is downloaded.

0g-compute-cli acknowledge-model --provider <PROVIDER_ADDRESS>  --data-path <PATH_TO_SAVE_MODEL>

Note: The model file downloaded with the above command is encrypted, and additional steps are required for decryption.

Decrypt Model
The provider will check the contract to verify if the user has confirmed the download, enabling the provider to settle fees successfully on the contract subsequently. Once the provider confirms the download, it uploads the key required for decryption to the contract, encrypted with the user's public key, and collects the fee. You can again use the get-task command to view the task status. When the status changes to Finished, it means the provider has uploaded the key. At this point, you can decrypt the model with the following command:

0g-compute-cli decrypt-model --provider <PROVIDER_ADDRESS> --encrypted-model <PATH_TO_ENCRYPTED_MODEL> --output <PATH_TO_SAVE_DECRYPTED_MODEL>


The above command performs the following operations:

Gets the encrypted key from the contract uploaded by the provider
Decrypts the key using the user's private key
Decrypts the model with the decrypted key
Note: The decrypted result will be saved as a zip file. Ensure that the <PATH_TO_SAVE_DECRYPTED_MODEL> ends with .zip (e.g., model_output.zip). After downloading, unzip the file to access the decrypted model.

Account Management
View Account
0g-compute-cli get-account

Possible output:

  Overview
┌──────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────┐
│ Balance                                          │ Value (OG)                                                                      │
├──────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
│ Total                                            │ 0.999999999820331942                                                            │
├──────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
│ Locked (transferred to sub-accounts)             │ 0.000000000179668154                                                            │
└──────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────┘

  Fine-tuning sub-accounts (Dynamically Created per Used Provider)
┌──────────────────────────────────────────────────┬──────────────────────────────┬──────────────────────────────────────────────────┐
│ Provider                                         │ Balance (OG)                 │ Requested Return to Main Account (OG)            │
├──────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────────────────┤
│ 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC       │ 0.000000000179668154         │ 0.000000000000000000                             │
├──────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────────────────┤
│ ......                                           │ ......                       │ ......                                           │
└──────────────────────────────────────────────────┴──────────────────────────────┴──────────────────────────────────────────────────┘


Overview: Provides a general overview of the account's balance.

Total: The current balance of the account
Locked: The cumulative amount locked in all sub-accounts
Fine-tuning sub-accounts: Information about sub-accounts, with each sub-account corresponding to a provider for paying the provider's service fee. Each sub-account is dynamically created when tasks are submitted.

Provider: Address of the provider corresponding to the sub-account
Balance: Balance of the sub-account, which is an amount transferred from the main account to the sub-account based on the task fee whenever a task is created.
Requested Return to Main Account: Amount requested to be returned from sub-accounts to the main account. If the amount in the sub-account goes unspent for any reason, such as a task failure, you can use the return-funds command to return the balance to the main account. However, it won't return immediately and will only be available after a lock-in period. For details, refer to Retrieving Funds.
Note: For more information about sub-accounts, refer to View Sub-Account.

Deposit
You can deposit into your account using the following command.

0g-compute-cli deposit --amount <AMOUNT>

Withdrawal
You can withdraw to your wallet with the following command:

0g-compute-cli refund --amount <AMOUNT>

Note: You can't withdraw the "Lock" amount in the account; only the "Total-Lock" portion can be withdrawn.

View Sub-Account
Sub-accounts are dynamically created when tasks are submitted and used to pay provider service fees. You can view sub-account information with the following command:

0g-compute-cli get-sub-account --provider <PROVIDER_ADDRESS>

Possible output:

  Overview
┌──────────────────────────────────────────────────┬──────────────────────────────────────────────────┐
│ Field                                            │ Value                                            │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Provider                                         │ 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC       │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Balance (OG)                                     │ 0.000000000179668154                             │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Funds Applied for Return to Main Account (OG)    │ 0.000000000179668154                             │
└──────────────────────────────────────────────────┴──────────────────────────────────────────────────┘

  Details of Each Amount Applied for Return to Main Account
┌──────────────────────────────────────────────────┬──────────────────────────────────────────────────┐
│ Amount (OG)                                      │ Remaining Locked Time                            │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ 0.000000000179668154                             │ 23h 58min 34s                                    │
└──────────────────────────────────────────────────┴──────────────────────────────────────────────────┘

  Deliverables
┌───────────────────────────────────────────────────────────────────────────┬─────────────────────────┐
│ Root Hash                                                                 │ Access Confirmed         │
├───────────────────────────────────────────────────────────────────────────┼─────────────────────────┤
│ 0x24951e897b1203e8aa1692736837f089a95b70390cc02723505e41ebf9              │ ✓                       │
│ cac70c                                                                    │                         │
├───────────────────────────────────────────────────────────────────────────┼─────────────────────────┤
│ 0x85b3869bcf14569bb41c3d7d499c9a8eb441e6d606bbe3e10e0fac90e5              │                         │
│ 7d36a4                                                                    │                         │
└───────────────────────────────────────────────────────────────────────────┴─────────────────────────┘

Overview: An overview of the account

Provider: Address of the provider corresponding to the sub-account
Balance: Balance of the sub-account. The main account transfers a certain amount to the sub-account based on the task fee every time a task is created.
Funds Applied for Return to Main Account: Amount in the sub-account requested to be returned to the main account
Details of Each Amount Applied for Return to Main Account: Detailed information about amounts requested to be returned to the main account

Amount: Amount requested to be returned to the main account
Remaining Locked Time: Remaining locked time for the return amount to be available in the main account
Deliverables: Deliverables issued by the provider after task completion

Root Hash: Root hash of the model uploaded to storage
Access Confirmed: Indicates whether the user has confirmed download access to the model based on the root hash
Retrieve Funds
The retrieve funds operation returns the balance from sub-accounts to the main account. This operation is asynchronous and will execute after a specific locking period of 24 hours. The lock time ensures provider rights protection, preventing the user from immediately returning the balance to the main account after provider services are rendered and stopping the provider from getting paid.

0g-compute-cli retrieve-fund

The above command requests the balance from all sub-accounts to be returned to the main account. After the lock-in period elapses, execute the retrieve-fund command again to refund all the amounts whose locking period has concluded to the main account. Check the refund status using the View Sub-Account command.

Other Commands
View Task List
You can view the list of tasks submitted to a specific provider using the following command:

0g-compute-cli list-tasks  --provider <PROVIDER_ADDRESS>

Download Data
You can download previously uploaded datasets using the command below:

0g-compute-cli download --data-path <PATH_TO_SAVE_DATASET> --data-root <DATASET_ROOT_HASH>

Cancel a Task
You can cancel a task before it starts running using the following command:

0g-compute-cli cancel-task --provider <PROVIDER_ADDRESS> --task <TASK_ID>

Note: Tasks that are already in progress or completed cannot be canceled.

Troubleshooting
Error: Provider busy
The provider is processing another task. Options:

Wait and retry later
Use a different provider: 0g-compute-cli list-providers
Queue your task (you'll be prompted)
Error: Insufficient balance
Add more funds:

0g-compute-cli deposit --amount 0.1

ЛОГИ
GLOBAL_ROOT="$(npm root -g)"

# 2) Экспорт переменных окружения
export RPC_ENDPOINT=https://evmrpc-testnet.0g.ai
export ZG_PRIVATE_KEY=0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65

# 3) Запуск CLI напрямую:
node "$GLOBAL_ROOT/@0glabs/0g-serving-broker/cli.commonjs/cli/index.js" --help
node "$GLOBAL_ROOT/@0glabs/0g-serving-broker/cli.commonjs/cli/index.js" list-providers
node "$GLOBAL_ROOT/@0glabs/0g-serving-broker/cli.commonjs/cli/index.js" get-account
node "$GLOBAL_ROOT/@0glabs/0g-serving-broker/cli.commonjs/cli/index.js" add-account --amount 0.01
Usage: 0g-compute-cli [options] [command]

CLI for interacting with ZG Compute Network

Options:
  -V, --version                output the version number
  -h, --help                   display help for command

Commands:
  verify [options]             verify TEE remote attestation of service
  list-models [options]        List available models
  model-usage [options]        Download detailed customized model usage
  upload [options]             Upload a dataset for fine-tuning
  download [options]           Download a data
  calculate-token [options]    Download token-counter
  create-task [options]        Create a fine-tuning task
  cancel-task [options]        Cancel a fine-tuning task
  list-tasks [options]         Retrieve all fine-tuning task
  get-task [options]           Retrieve fine-tuning task information
  get-log [options]            Retrieve fine-tuning task log
  acknowledge-model [options]  Acknowledge the availability of a model
  decrypt-model [options]      Decrypt a model
  download-counter             Download token-counter
  ack-provider [options]       verify TEE remote attestation of service
  serve [options]              Start local inference service
  get-account [options]        Retrieve account information
  add-account [options]        Add account balance
  deposit [options]            Deposit funds into the account
  refund [options]             Refund an amount from the account
  retrieve-fund [options]      Retrieve fund from sub account
  get-sub-account [options]    Retrieve sub account information
  list-providers [options]     List providers
  help [command]               display help for command
┌──────────────────────────────────────────────────┬──────────────────────────────────────────────────┐
│ Provider 1                                       │ 0x960E74Fc0AF1a6fBcADA3eEFCBe3152fA5E87A5f       │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Available                                        │ ✓                                                │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Price Per Byte in Dataset (A0GI)                 │ 0.000000000000000001                             │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Provider 2                                       │ 0xf07240Efa67755B5311bc75784a061eDB47165Dd       │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Available                                        │ ✓                                                │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Price Per Byte in Dataset (A0GI)                 │ 0.000000000000000001                             │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Provider 3                                       │ 0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3       │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Available                                        │ ✓                                                │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Price Per Byte in Dataset (A0GI)                 │ 0.000000000000000001                             │
└──────────────────────────────────────────────────┴──────────────────────────────────────────────────┘

  Overview
┌──────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────┐
│ Balance                                          │ Value (A0GI)                                                                    │
├──────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
│ Total                                            │ 0.009999999999998354                                                            │
├──────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
│ Locked (transferred to sub-accounts)             │ 0.000000000040038354                                                            │
└──────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────┘

  Inference sub-accounts (Dynamically Created per Used Provider)
┌──────────────────────────────────────────────────┬──────────────────────────────┬──────────────────────────────────────────────────┐
│ Provider                                         │ Balance (A0GI)               │ Requested Return to Main Account (A0GI)          │
├──────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────────────────┤
│ 0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3       │ 0.000000000020018388         │ 0.000000000000000000                             │
├──────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────────────────┤
│ 0xf07240Efa67755B5311bc75784a061eDB47165Dd       │ 0.000000000020019966         │ 0.000000000000000000                             │
├──────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────────────────┤
│ 0x9BF829f22BfA7C20bdEaa07EaE59Bf2733275bfa       │ 0.000000000000000000         │ 0.000000000000000000                             │
└──────────────────────────────────────────────────┴──────────────────────────────┴──────────────────────────────────────────────────┘
Adding account...
Operation failed: Error: Ledger already exists, with balance: 0.009999999999998354 A0GI
export MODEL="distilbert-base-uncased"
node "$CLI" model-usage --provider "$PROVIDER" --model "$MODEL" --output config.toml
Predefined Model:
┌──────────────────────────────┬───────────────────────────────────────────────────────────────────────────┐
│ Name                         │ Description                                                               │
├──────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ distilbert-base-uncased      │ DistilBERT is a transformers model, smaller and faster than BERT, which w │
│                              │ as pretrained on the same corpus in a self-supervised fashion, using the  │
│                              │ BERT base model as a teacher. More details can be found at: https://huggi │
│                              │ ngface.co/distilbert/distilbert-base-uncased                              │
└──────────────────────────────┴───────────────────────────────────────────────────────────────────────────┘
Provider's Model:
┌──────────────────────────────┬───────────────────────────────────────────────────────────────────────────┬─────────────────────────────────────────────┐
│ Name                         │ Description                                                               │ Provider                                    │
└──────────────────────────────┴───────────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────┘
Operation failed: AxiosError: Request failed with status code 400
    at settle (/root/.nvm/versions/node/v22.17.1/lib/node_modules/@0glabs/0g-serving-broker/node_modules/axios/dist/node/axios.cjs:2090:12)
    at IncomingMessage.handleStreamEnd (/root/.nvm/versions/node/v22.17.1/lib/node_modules/@0glabs/0g-serving-broker/node_modules/axios/dist/node/axios.cjs:3207:11)
    at IncomingMessage.emit (node:events:530:35)
    at endReadableNT (node:internal/streams/readable:1698:12)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
    at Axios.request (/root/.nvm/versions/node/v22.17.1/lib/node_modules/@0glabs/0g-serving-broker/node_modules/axios/dist/node/axios.cjs:4317:41)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async Provider.getCustomizedModelDetailUsage (/root/.nvm/versions/node/v22.17.1/lib/node_modules/@0glabs/0g-serving-broker/cli.commonjs/sdk/fine-tuning/provider/provider.js:185:30)
    at async ServiceProcessor.modelUsage (/root/.nvm/versions/node/v22.17.1/lib/node_modules/@0glabs/0g-serving-broker/cli.commonjs/sdk/fine-tuning/broker/service.js:216:20)
    at async /root/.nvm/versions/node/v22.17.1/lib/node_modules/@0glabs/0g-serving-broker/cli.commonjs/cli/fine-tuning.js:83:13
    at async withFineTuningBroker (/root/.nvm/versions/node/v22.17.1/lib/node_modules/@0glabs/0g-serving-broker/cli.commonjs/cli/util.js:30:13) {
  code: 'ERR_BAD_REQUEST',
  config: {
    transitional: {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    },
    adapter: [ 'xhr', 'http', 'fetch' ],
    transformRequest: [ [Function: transformRequest] ],
    transformResponse: [ [Function: transformResponse] ],
    timeout: 0,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
    env: { FormData: [Function [FormData]], Blob: [class Blob] },
    validateStatus: [Function: validateStatus],
    headers: Object [AxiosHeaders] {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': undefined,
      'User-Agent': 'axios/1.11.0',
      'Accept-Encoding': 'gzip, compress, deflate, br'
    },
    method: 'get',
    url: 'http://50.145.48.68:30080/v1/model/desc/distilbert-base-uncased',
    responseType: 'arraybuffer',
    allowAbsoluteUrls: true,
    data: undefined
  },
  request: <ref *1> ClientRequest {
    _events: [Object: null prototype] {
      abort: [Function (anonymous)],
      aborted: [Function (anonymous)],
      connect: [Function (anonymous)],
      error: [Function (anonymous)],
      socket: [Function (anonymous)],
      timeout: [Function (anonymous)],
      finish: [Function: requestOnFinish]
    },
    _eventsCount: 7,
    _maxListeners: undefined,
    outputData: [],
    outputSize: 0,
    writable: true,
    destroyed: true,
    _last: true,
    chunkedEncoding: false,
    shouldKeepAlive: true,
    maxRequestsOnConnectionReached: false,
    _defaultKeepAlive: true,
    useChunkedEncodingByDefault: false,
    sendDate: false,
    _removedConnection: false,
    _removedContLen: false,
    _removedTE: false,
    strictContentLength: false,
    _contentLength: 0,
    _hasBody: true,
    _trailer: '',
    finished: true,
    _headerSent: true,
    _closed: true,
    _header: 'GET /v1/model/desc/distilbert-base-uncased HTTP/1.1\r\n' +
      'Accept: application/json, text/plain, */*\r\n' +
      'User-Agent: axios/1.11.0\r\n' +
      'Accept-Encoding: gzip, compress, deflate, br\r\n' +
      'Host: 50.145.48.68:30080\r\n' +
      'Connection: keep-alive\r\n' +
      '\r\n',
    _keepAliveTimeout: 0,
    _onPendingData: [Function: nop],
    agent: Agent {
      _events: [Object: null prototype],
      _eventsCount: 2,
      _maxListeners: undefined,
      defaultPort: 80,
      protocol: 'http:',
      options: [Object: null prototype],
      requests: [Object: null prototype] {},
      sockets: [Object: null prototype] {},
      freeSockets: [Object: null prototype],
      keepAliveMsecs: 1000,
      keepAlive: true,
      maxSockets: Infinity,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      maxTotalSockets: Infinity,
      totalSocketCount: 1,
      [Symbol(shapeMode)]: false,
      [Symbol(kCapture)]: false
    },
    socketPath: undefined,
    method: 'GET',
    maxHeaderSize: undefined,
    insecureHTTPParser: undefined,
    joinDuplicateHeaders: undefined,
    path: '/v1/model/desc/distilbert-base-uncased',
    _ended: true,
    res: IncomingMessage {
      _events: [Object],
      _readableState: [ReadableState],
      _maxListeners: undefined,
      socket: null,
      httpVersionMajor: 1,
      httpVersionMinor: 1,
      httpVersion: '1.1',
      complete: true,
      rawHeaders: [Array],
      rawTrailers: [],
      joinDuplicateHeaders: undefined,
      aborted: false,
      upgrade: false,
      url: '',
      method: null,
      statusCode: 400,
      statusMessage: 'Bad Request',
      client: [Socket],
      _consuming: false,
      _dumped: false,
      req: [Circular *1],
      _eventsCount: 4,
      responseUrl: 'http://50.145.48.68:30080/v1/model/desc/distilbert-base-uncased',
      redirects: [],
      [Symbol(shapeMode)]: true,
      [Symbol(kCapture)]: false,
      [Symbol(kHeaders)]: [Object],
      [Symbol(kHeadersCount)]: 6,
      [Symbol(kTrailers)]: null,
      [Symbol(kTrailersCount)]: 0
    },
    aborted: false,
    timeoutCb: null,
    upgradeOrConnect: false,
    parser: null,
    maxHeadersCount: null,
    reusedSocket: false,
    host: '50.145.48.68',
    protocol: 'http:',
    _redirectable: Writable {
      _events: [Object],
      _writableState: [WritableState],
      _maxListeners: undefined,
      _options: [Object],
      _ended: true,
      _ending: true,
      _redirectCount: 0,
      _redirects: [],
      _requestBodyLength: 0,
      _requestBodyBuffers: [],
      _eventsCount: 3,
      _onNativeResponse: [Function (anonymous)],
      _currentRequest: [Circular *1],
      _currentUrl: 'http://50.145.48.68:30080/v1/model/desc/distilbert-base-uncased',
      [Symbol(shapeMode)]: true,
      [Symbol(kCapture)]: false
    },
    [Symbol(shapeMode)]: false,
    [Symbol(kCapture)]: false,
    [Symbol(kBytesWritten)]: 0,
    [Symbol(kNeedDrain)]: false,
    [Symbol(corked)]: 0,
    [Symbol(kChunkedBuffer)]: [],
    [Symbol(kChunkedLength)]: 0,
    [Symbol(kSocket)]: Socket {
      connecting: false,
      _hadError: false,
      _parent: null,
      _host: null,
      _closeAfterHandlingError: false,
      _events: [Object],
      _readableState: [ReadableState],
      _writableState: [WritableState],
      allowHalfOpen: false,
      _maxListeners: undefined,
      _eventsCount: 6,
      _sockname: null,
      _pendingData: null,
      _pendingEncoding: '',
      server: null,
      _server: null,
      timeout: 5000,
      parser: null,
      _httpMessage: null,
      [Symbol(async_id_symbol)]: -1,
      [Symbol(kHandle)]: [TCP],
      [Symbol(lastWriteQueueSize)]: 0,
      [Symbol(timeout)]: Timeout {
        _idleTimeout: 5000,
        _idlePrev: [TimersList],
        _idleNext: [Timeout],
        _idleStart: 2431,
        _onTimeout: [Function: bound ],
        _timerArgs: undefined,
        _repeat: null,
        _destroyed: false,
        [Symbol(refed)]: false,
        [Symbol(kHasPrimitive)]: false,
        [Symbol(asyncId)]: 57,
        [Symbol(triggerId)]: 55,
        [Symbol(kAsyncContextFrame)]: undefined
      },
      [Symbol(kBuffer)]: null,
      [Symbol(kBufferCb)]: null,
      [Symbol(kBufferGen)]: null,
      [Symbol(shapeMode)]: true,
      [Symbol(kCapture)]: false,
      [Symbol(kSetNoDelay)]: true,
      [Symbol(kSetKeepAlive)]: true,
      [Symbol(kSetKeepAliveInitialDelay)]: 1,
      [Symbol(kBytesRead)]: 0,
      [Symbol(kBytesWritten)]: 0
    },
    [Symbol(kOutHeaders)]: [Object: null prototype] {
      accept: [Array],
      'user-agent': [Array],
      'accept-encoding': [Array],
      host: [Array]
    },
    [Symbol(errored)]: null,
    [Symbol(kHighWaterMark)]: 65536,
    [Symbol(kRejectNonStandardBodyWrites)]: false,
    [Symbol(kUniqueHeaders)]: null
  },
  response: {
    status: 400,
    statusText: 'Bad Request',
    headers: Object [AxiosHeaders] {
      'content-type': 'application/json; charset=utf-8',
      date: 'Tue, 29 Jul 2025 08:48:08 GMT',
      'content-length': '89'
    },
    config: {
      transitional: [Object],
      adapter: [Array],
      transformRequest: [Array],
      transformResponse: [Array],
      timeout: 0,
      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',
      maxContentLength: -1,
      maxBodyLength: -1,
      env: [Object],
      validateStatus: [Function: validateStatus],
      headers: [Object [AxiosHeaders]],
      method: 'get',
      url: 'http://50.145.48.68:30080/v1/model/desc/distilbert-base-uncased',
      responseType: 'arraybuffer',
      allowAbsoluteUrls: true,
      data: undefined
    },
    request: <ref *1> ClientRequest {
      _events: [Object: null prototype],
      _eventsCount: 7,
      _maxListeners: undefined,
      outputData: [],
      outputSize: 0,
      writable: true,
      destroyed: true,
      _last: true,
      chunkedEncoding: false,
      shouldKeepAlive: true,
      maxRequestsOnConnectionReached: false,
      _defaultKeepAlive: true,
      useChunkedEncodingByDefault: false,
      sendDate: false,
      _removedConnection: false,
      _removedContLen: false,
      _removedTE: false,
      strictContentLength: false,
      _contentLength: 0,
      _hasBody: true,
      _trailer: '',
      finished: true,
      _headerSent: true,
      _closed: true,
      _header: 'GET /v1/model/desc/distilbert-base-uncased HTTP/1.1\r\n' +
        'Accept: application/json, text/plain, */*\r\n' +
        'User-Agent: axios/1.11.0\r\n' +
        'Accept-Encoding: gzip, compress, deflate, br\r\n' +
        'Host: 50.145.48.68:30080\r\n' +
        'Connection: keep-alive\r\n' +
        '\r\n',
      _keepAliveTimeout: 0,
      _onPendingData: [Function: nop],
      agent: [Agent],
      socketPath: undefined,
      method: 'GET',
      maxHeaderSize: undefined,
      insecureHTTPParser: undefined,
      joinDuplicateHeaders: undefined,
      path: '/v1/model/desc/distilbert-base-uncased',
      _ended: true,
      res: [IncomingMessage],
      aborted: false,
      timeoutCb: null,
      upgradeOrConnect: false,
      parser: null,
      maxHeadersCount: null,
      reusedSocket: false,
      host: '50.145.48.68',
      protocol: 'http:',
      _redirectable: [Writable],
      [Symbol(shapeMode)]: false,
      [Symbol(kCapture)]: false,
      [Symbol(kBytesWritten)]: 0,
      [Symbol(kNeedDrain)]: false,
      [Symbol(corked)]: 0,
      [Symbol(kChunkedBuffer)]: [],
      [Symbol(kChunkedLength)]: 0,
      [Symbol(kSocket)]: [Socket],
      [Symbol(kOutHeaders)]: [Object: null prototype],
      [Symbol(errored)]: null,
      [Symbol(kHighWaterMark)]: 65536,
      [Symbol(kRejectNonStandardBodyWrites)]: false,
      [Symbol(kUniqueHeaders)]: null
    },
    data: <Buffer 7b 22 65 72 72 6f 72 22 3a 22 50 72 6f 76 69 64 65 72 3a 20 67 65 74 20 6d 6f 64 65 6c 20 64 65 73 63 72 69 70 74 69 6f 6e 20 66 69 6c 65 3a 20 4d 6f ... 39 more bytes>
  },
  status: 400
}
root@elite-mint:~# export ZGS_SKIP_TX=1
export ZGS_FINALITY_REQUIRED=0
node "$CLI" upload --data-path "/root/dataset/train.txt"
INFO[2025-07-29T08:54:10Z] get 4 storage nodes from indexer: [http://47.251.79.83:5678 http://47.251.78.104:5678 http://47.238.87.44:5678 http://47.76.30.235:5678]

INFO[2025-07-29T08:54:11Z] fragment size: 4294967296
INFO[2025-07-29T08:54:11Z] Data prepared to upload                       chunks=1 segments=1 size=54

INFO[2025-07-29T08:54:11Z] Data merkle root calculated                   root=0x16d124afe2d6948e963c2539cc203331251c2ce4856104899ec036e81fd8c03d

INFO[2025-07-29T08:54:13Z] Prepare to submit log entry                   root=0x16d124afe2d6948e963c2539cc203331251c2ce4856104899ec036e81fd8c03d

INFO[2025-07-29T08:54:13Z] submit with fee                               fee(neuron)=596046447753
DEBU[2025-07-29T08:54:13Z] Set retry options                             maxNonGasRetries=20 timeout=0s

INFO[2025-07-29T08:54:13Z] Set nonce                                     nonce=296

DEBU[2025-07-29T08:54:14Z] Receive current gas price from chain node     gasPrice=1000018
INFO[2025-07-29T08:54:14Z] Set gas price                                 gasPrice=1000018

INFO[2025-07-29T08:54:15Z] Transaction receipt                           receipt="<nil>" txHash=0x2648460bd6fd38246c728351de38c43b89a9b54614aa7d851163e5d77bf59678

INFO[2025-07-29T08:54:18Z] Transaction receipt                           receipt="<nil>" txHash=0x2648460bd6fd38246c728351de38c43b89a9b54614aa7d851163e5d77bf59678

INFO[2025-07-29T08:54:22Z] Transaction receipt                           receipt="&{0x7f8596fe97fc1141632b0166f7a62ed62de65d3a00e7ad6073ea65f7e714b5b8 4510068 <nil> <nil> 5303123 1000018 0x432330379Af04Dd2770557C711d82f88072cE3d5 325077 [0xc000000000] [0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 16 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 128 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 64 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 128 0 0 2 0 0 0 0 0 0 0 0 0 0 0 8 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0] [] 0xc000929260 0xbD75117F80b4E22698D0Cd7612d92BDb8eaff628 0x2648460bd6fd38246c728351de38c43b89a9b54614aa7d851163e5d77bf59678 34 <nil> 0xc000929270}" txHash=0x2648460bd6fd38246c728351de38c43b89a9b54614aa7d851163e5d77bf59678

INFO[2025-07-29T08:54:25Z] Succeeded to send transaction to append log entry  hash=0x2648460bd6fd38246c728351de38c43b89a9b54614aa7d851163e5d77bf59678

INFO[2025-07-29T08:54:25Z] Wait for log entry on storage node            finality=1 root=0x16d124afe2d6948e963c2539cc203331251c2ce4856104899ec036e81fd8c03d

INFO[2025-07-29T08:54:27Z] Begin to upload file                          nodeNum=4 root=0x16d124afe2d6948e963c2539cc203331251c2ce4856104899ec036e81fd8c03d segNum=1 sequence=4521627

DEBU[2025-07-29T08:54:29Z] Segments uploaded                             from_seg_index=0 root=0x16d124afe2d6948e963c2539cc203331251c2ce4856104899ec036e81fd8c03d step=4 to_node="http://47.251.78.104:5678" to_seg_index=0 total=1

INFO[2025-07-29T08:54:29Z] Completed to upload file                      duration=1.839162995s root=0x16d124afe2d6948e963c2539cc203331251c2ce4856104899ec036e81fd8c03d segNum=1 sequence=4521627
INFO[2025-07-29T08:54:29Z] Wait for log entry on storage node            finality=1 root=0x16d124afe2d6948e963c2539cc203331251c2ce4856104899ec036e81fd8c03d

INFO[2025-07-29T08:54:31Z] upload took                                   duration=19.733833483s
INFO[2025-07-29T08:54:31Z] file uploaded, root = 0x16d124afe2d6948e963c2539cc203331251c2ce4856104899ec036e81fd8c03d

root@elite-mint:~# node "$CLI" cancel-task  \
  --provider "$PROVIDER" \
  --task     8e28e76a-c34e-40f9-97e1-5766af2170b1
task 8e28e76a-c34e-40f9-97e1-5766af2170b1 cancelled
root@elite-mint:~# node "$CLI" create-task \
  --provider    "$PROVIDER" \
  --model       "$MODEL"    \
  --dataset     "$DATASET_ROOT" \
  --config-path ./config.json   \
  --data-size   "$DATA_SIZE"
Verify provider...
Quote verification: true
Provider signer already acknowledged
Provider verified
Creating task...
Estimated fee: 0 (neuron), data size: 0, train epochs: 3, price per token: 1 (neuron)
Created Task ID: 7c7d8940-5d6b-478f-b6aa-f782825e028a
root@elite-mint:~# node "$CLI" get-log --provider "$PROVIDER" --task 7c7d8940-5d6b-478f-b6aa-f782825e028a
[2025-07-29T09:19:46Z] creating task....
[2025-07-29T09:20:22Z] Error executing task 7c7d8940-5d6b-478f-b6aa-f782825e028a: zip: not a valid zip file
[2025-07-29T09:20:22Z] Retrying task 7c7d8940-5d6b-478f-b6aa-f782825e028a

root@elite-mint:~# node "$CLI" get-task \
  --provider "$PROVIDER" \
  --task     7c7d8940-5d6b-478f-b6aa-f782825e028a
url http://50.145.48.68:30080
endpoint http://50.145.48.68:30080/v1/user/0x432330379Af04Dd2770557C711d82f88072cE3d5/task/7c7d8940-5d6b-478f-b6aa-f782825e028a
┌───────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────┐
│ Field                             │ Value                                                                               │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ ID                                │ 7c7d8940-5d6b-478f-b6aa-f782825e028a                                                │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Created At                        │ 2025-07-29T09:19:46.445Z                                                            │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Pre-trained Model Hash            │ 0x7f2244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110a7                  │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Dataset Hash                      │ 0x16d124afe2d6948e963c2539cc203331251c2ce4856104899ec036e81fd8c03d                  │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Training Params                   │ {                                                                                   │
│                                   │   "num_train_epochs": 3,                                                            │
│                                   │   "per_device_train_batch_size": 16,                                                │
│                                   │   "per_device_ev                                                                    │
│                                   │ al_batch_size": 16,                                                                 │
│                                   │   "warmup_steps": 500,                                                              │
│                                   │   "weight_decay": 0.01,                                                             │
│                                   │   "logging_di                                                                       │
│                                   │ r": "./logs",                                                                       │
│                                   │   "logging_steps": 100,                                                             │
│                                   │   "evaluation_strategy": "no",                                                      │
│                                   │   "save_str                                                                         │
│                                   │ ategy": "epoch",                                                                    │
│                                   │   "save_steps": 1,                                                                  │
│                                   │   "save_total_limit": 1,                                                            │
│                                   │   "eval_steps": 50,                                                                 │
│                                   │                                                                                     │
│                                   │   "load_best_model_at_end": false,                                                  │
│                                   │   "metric_for_best_model": "accuracy",                                              │
│                                   │   "gr                                                                               │
│                                   │ eater_is_better": true,                                                             │
│                                   │   "report_to": ["none"]                                                             │
│                                   │ }                                                                                   │
│                                   │                                                                                     │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Fee (neuron)                      │ 0                                                                                   │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Progress                          │ Init                                                                                │
└───────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────┘
root@elite-mint:~#

