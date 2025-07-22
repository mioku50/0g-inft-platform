const { ethers } = require("ethers");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

async function main() {
  // Прямое подключение без hardhat
  const provider = new ethers.JsonRpcProvider(process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log("Deploying with:", wallet.address);
  
  // Читаем ABI и bytecode
  const contractJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/ComputeOracle.sol/ComputeOracle.json"), "utf8")
  );
  
  // Деплоим контракт
  const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet);
  const oracle = await factory.deploy();
  
  await oracle.waitForDeployment();
  const address = await oracle.getAddress();
  
  console.log("ComputeOracle deployed to:", address);
  
  // Обновляем .env
  const envPath = path.join(__dirname, "../../web/.env");
  let envContent = fs.readFileSync(envPath, "utf-8");
  const key = "NEXT_PUBLIC_COMPUTE_ORACLE_ADDRESS";
  
  if (envContent.includes(key)) {
    envContent = envContent.replace(new RegExp(`${key}=.*`, "g"), `${key}=${address}`);
  } else {
    envContent += `\n${key}=${address}\n`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log("Updated .env file");
}

main().catch(console.error);