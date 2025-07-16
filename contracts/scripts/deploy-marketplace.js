const { ethers } = require("hardhat");

async function main() {
  const INFT_ADDRESS = "0x25DB0F8e03eF8E9d81d975c0839F4c8e609e701b";
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AgentMarketplace with:", deployer.address);
  
  const AgentMarketplace = await ethers.getContractFactory("AgentMarketplace");
  const marketplace = await AgentMarketplace.deploy(INFT_ADDRESS);
  await marketplace.waitForDeployment();
  
  console.log("AgentMarketplace deployed to:", await marketplace.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
