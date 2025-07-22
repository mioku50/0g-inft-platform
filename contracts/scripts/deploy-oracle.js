const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying ComputeOracle...");

  const ComputeOracle = await hre.ethers.getContractFactory("ComputeOracle");
  const oracle = await ComputeOracle.deploy();
  
  await oracle.waitForDeployment();
  const address = await oracle.getAddress();
  
  console.log("ComputeOracle deployed to:", address);

  // Update .env file
  const envPath = path.join(__dirname, "../../web/.env");
  let envContent = "";
  
  try {
    envContent = fs.readFileSync(envPath, "utf-8");
  } catch (e) {
    console.log("Creating new .env file");
  }

  const key = "NEXT_PUBLIC_COMPUTE_ORACLE_ADDRESS";
  const line = `${key}=${address}`;
  
  if (envContent.includes(key)) {
    envContent = envContent.replace(new RegExp(`${key}=.*`, "g"), line);
  } else {
    envContent += `\n${line}\n`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log("Updated web/.env with new oracle address");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });