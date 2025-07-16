// contracts/scripts/deploy.js
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("?? Starting deployment to 0G Testnet...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const deployerBalance = await deployer.provider.getBalance(deployer.address);
  
  console.log("?? Deployer address:", deployer.address);
  console.log("?? Deployer balance:", ethers.formatEther(deployerBalance), "A0GI\n");

  // Check if balance is sufficient
  if (deployerBalance < ethers.parseEther("0.1")) {
    console.error("? Insufficient balance! Please fund your account with at least 0.1 A0GI");
    console.log("?? Get testnet tokens from: https://faucet.0g.ai");
    process.exit(1);
  }

  // Deploy MockOracle first
  console.log("?? Deploying MockOracle...");
  const MockOracle = await ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  const oracleReceipt = await oracle.deploymentTransaction().wait();
  console.log("? MockOracle deployed to:", oracleAddress);
  console.log("   Gas used:", oracleReceipt.gasUsed.toString());

  // Deploy INFT contract with new features
  console.log("\n?? Deploying INFT contract...");
  const INFT = await ethers.getContractFactory("INFT");
  const inft = await INFT.deploy(
    "0G AI Agent NFTs",      // name
    "0GAINFT",               // symbol
    oracleAddress            // oracle address
  );
  await inft.waitForDeployment();
  const inftAddress = await inft.getAddress();
  const inftReceipt = await inft.deploymentTransaction().wait();
  console.log("? INFT deployed to:", inftAddress);
  console.log("   Gas used:", inftReceipt.gasUsed.toString());

  // Deploy AgentMarketplace
  console.log("\n?? Deploying AgentMarketplace...");
  const AgentMarketplace = await ethers.getContractFactory("AgentMarketplace");
  const marketplace = await AgentMarketplace.deploy(inftAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  const marketplaceReceipt = await marketplace.deploymentTransaction().wait();
  console.log("? AgentMarketplace deployed to:", marketplaceAddress);
  console.log("   Gas used:", marketplaceReceipt.gasUsed.toString());

  // Deploy MockComputeOracle
  console.log("\n?? Deploying MockComputeOracle...");
  const MockComputeOracle = await ethers.getContractFactory("MockComputeOracle");
  const computeOracle = await MockComputeOracle.deploy();
  await computeOracle.waitForDeployment();
  const computeOracleAddress = await computeOracle.getAddress();
  const computeOracleReceipt = await computeOracle.deploymentTransaction().wait();
  console.log("? MockComputeOracle deployed to:", computeOracleAddress);
  console.log("   Gas used:", computeOracleReceipt.gasUsed.toString());

  // Deploy AIExecutor
  console.log("\n?? Deploying AIExecutor...");
  const AIExecutor = await ethers.getContractFactory("AIExecutor");
  const aiExecutor = await AIExecutor.deploy(inftAddress, computeOracleAddress);
  await aiExecutor.waitForDeployment();
  const aiExecutorAddress = await aiExecutor.getAddress();
  const aiExecutorReceipt = await aiExecutor.deploymentTransaction().wait();
  console.log("? AIExecutor deployed to:", aiExecutorAddress);
  console.log("   Gas used:", aiExecutorReceipt.gasUsed.toString());

  // Save deployment addresses
  const deploymentInfo = {
    network: "0g-testnet",
    chainId: 16601,
    deployedAt: new Date().toISOString(),
    contracts: {
      MockOracle: {
        address: oracleAddress,
        deployer: deployer.address
      },
      INFT: {
        address: inftAddress,
        deployer: deployer.address
      },
      AgentMarketplace: {
        address: marketplaceAddress,
        deployer: deployer.address
      },
      MockComputeOracle: {
        address: computeOracleAddress,
        deployer: deployer.address
      },
      AIExecutor: {
        address: aiExecutorAddress,
        deployer: deployer.address
      }
    }
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment info
  const deploymentPath = path.join(deploymentsDir, "0g-testnet.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n?? Deployment info saved to:", deploymentPath);

  // Print summary
  console.log("\n? Deployment Summary:");
  console.log("=======================");
  console.log("Network: 0G Testnet (Chain ID: 16601)");
  console.log("MockOracle:", oracleAddress);
  console.log("INFT:", inftAddress);
  console.log("AgentMarketplace:", marketplaceAddress);
  console.log("MockComputeOracle:", computeOracleAddress);
  console.log("AIExecutor:", aiExecutorAddress);
  console.log("\n?? Next steps:");
  console.log("1. Update your .env file with these addresses:");
  console.log(`   NEXT_PUBLIC_INFT_CONTRACT_ADDRESS=${inftAddress}`);
  console.log(`   NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=${marketplaceAddress}`);
  console.log(`   NEXT_PUBLIC_ORACLE_CONTRACT_ADDRESS=${oracleAddress}`);
  console.log(`   NEXT_PUBLIC_COMPUTE_ORACLE_ADDRESS=${computeOracleAddress}`);
  console.log(`   NEXT_PUBLIC_AI_EXECUTOR_ADDRESS=${aiExecutorAddress}`);
  console.log("\n2. Verify contracts (optional):");
  console.log(`   npx hardhat verify --network 0g-testnet ${oracleAddress}`);
  console.log(`   npx hardhat verify --network 0g-testnet ${inftAddress} "0G AI Agent NFTs" "0GAINFT" ${oracleAddress}`);
  console.log(`   npx hardhat verify --network 0g-testnet ${marketplaceAddress} ${inftAddress}`);
  console.log(`   npx hardhat verify --network 0g-testnet ${computeOracleAddress}`);
  console.log(`   npx hardhat verify --network 0g-testnet ${aiExecutorAddress} ${inftAddress} ${computeOracleAddress}`);
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("? Deployment failed:", error);
    process.exit(1);
  });