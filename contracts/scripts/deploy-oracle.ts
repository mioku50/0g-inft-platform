import { ethers } from 'hardhat'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(process.cwd(), '.env') })

async function main() {
  const Oracle = await ethers.getContractFactory('ComputeOracle')
  const oracle = await Oracle.deploy()
  await oracle.waitForDeployment()
  const address = await oracle.getAddress()
  console.log('ComputeOracle deployed to:', address)

  const envPath = path.join(process.cwd(), '.env')
  let env = ''
  try { env = fs.readFileSync(envPath, 'utf-8') } catch {}
  const line = `NEXT_PUBLIC_COMPUTE_ORACLE_ADDRESS=${address}`
  if (env.includes('NEXT_PUBLIC_COMPUTE_ORACLE_ADDRESS')) {
    env = env.replace(/NEXT_PUBLIC_COMPUTE_ORACLE_ADDRESS=.*/g, line)
  } else {
    env += `\n${line}\n`
  }
  fs.writeFileSync(envPath, env)
  console.log('Updated .env')
}

main().catch(err => { console.error(err); process.exit(1) })
