const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");
  
  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy MockOracle
  console.log("\nDeploying MockOracle...");
  const MockOracle = await hre.ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy();
  await oracle.deployed();
  console.log("MockOracle deployed to:", oracle.address);

  // Deploy INFT
  console.log("\nDeploying INFT...");
  const INFT = await hre.ethers.getContractFactory("INFT");
  const inft = await INFT.deploy(
    "0G AI Agents",
    "0GAINFT",
    oracle.address
  );
  await inft.deployed();
  console.log("INFT deployed to:", inft.address);

  // Deploy AgentMarketplace
  console.log("\nDeploying AgentMarketplace...");
  const AgentMarketplace = await hre.ethers.getContractFactory("AgentMarketplace");
  const marketplace = await AgentMarketplace.deploy(
    inft.address,
    oracle.address
  );
  await marketplace.deployed();
  console.log("AgentMarketplace deployed to:", marketplace.address);

  // Verify contracts on explorer (if not on localhost)
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nWaiting for block confirmations...");
    await oracle.deployTransaction.wait(5);
    await inft.deployTransaction.wait(5);
    await marketplace.deployTransaction.wait(5);

    console.log("\nVerifying contracts...");
    try {
      await hre.run("verify:verify", {
        address: oracle.address,
        constructorArguments: [],
      });
      console.log("MockOracle verified");
    } catch (error) {
      console.log("MockOracle verification failed:", error.message);
    }

    try {
      await hre.run("verify:verify", {
        address: inft.address,
        constructorArguments: ["0G AI Agents", "0GAINFT", oracle.address],
      });
      console.log("INFT verified");
    } catch (error) {
      console.log("INFT verification failed:", error.message);
    }

    try {
      await hre.run("verify:verify", {
        address: marketplace.address,
        constructorArguments: [inft.address, oracle.address],
      });
      console.log("AgentMarketplace verified");
    } catch (error) {
      console.log("AgentMarketplace verification failed:", error.message);
    }
  }

  console.log("\n?? Deployment complete!");
  console.log("--------------------------------");
  console.log("INFT Contract:", inft.address);
  console.log("Marketplace Contract:", marketplace.address);
  console.log("Oracle Contract:", oracle.address);
  console.log("--------------------------------");
  console.log("\nUpdate your .env.local file with these addresses:");
  console.log(`NEXT_PUBLIC_INFT_CONTRACT_ADDRESS=${inft.address}`);
  console.log(`NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=${marketplace.address}`);
  console.log(`NEXT_PUBLIC_ORACLE_CONTRACT_ADDRESS=${oracle.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// ===================================