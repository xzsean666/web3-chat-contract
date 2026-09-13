import hre from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const { viem } = await hre.network.getOrCreate();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  const chainId = await publicClient.getChainId();
  const balance = await publicClient.getBalance({
    address: deployer.account.address,
  });

  console.log("==================================================");
  console.log("  EVM Chat State Storage Protocol Deployment");
  console.log("==================================================");
  console.log(`Network Chain ID : ${chainId}`);
  console.log(`Deployer Address : ${deployer.account.address}`);
  console.log(`Deployer Balance : ${balance.toString()} wei`);
  console.log("--------------------------------------------------");

  // 1. Deploy Implementation Contracts
  console.log("1. Deploying UserImplementation...");
  const userImpl = await viem.deployContract("UserImplementation");
  console.log(`   UserImplementation deployed at: ${userImpl.address}`);

  console.log("2. Deploying GroupImplementation...");
  const groupImpl = await viem.deployContract("GroupImplementation");
  console.log(`   GroupImplementation deployed at: ${groupImpl.address}`);

  // 2. Deploy Factory
  console.log("3. Deploying ChatStorageFactory...");
  const factory = await viem.deployContract("ChatStorageFactory", [
    userImpl.address,
    groupImpl.address,
  ]);
  console.log(`   ChatStorageFactory deployed at: ${factory.address}`);

  // 3. Deploy RelationshipManager
  console.log("4. Deploying RelationshipManager...");
  const relMgr = await viem.deployContract("RelationshipManager", [
    factory.address,
  ]);
  console.log(`   RelationshipManager deployed at: ${relMgr.address}`);

  // 4. Configure Factory
  console.log("5. Configuring RelationshipManager in Factory...");
  const hash = await factory.write.setRelationshipManager([relMgr.address], {
    account: deployer.account,
  });
  console.log(`   Configured tx hash: ${hash}`);

  // 5. Record Deployment Metadata
  const deploymentData = {
    network: hre.network.name,
    chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.account.address,
    contracts: {
      UserImplementation: userImpl.address,
      GroupImplementation: groupImpl.address,
      ChatStorageFactory: factory.address,
      RelationshipManager: relMgr.address,
    },
  };

  const deploymentsDir = resolve(process.cwd(), "deployments");
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }

  const filePath = resolve(deploymentsDir, `${chainId}.json`);
  writeFileSync(filePath, JSON.stringify(deploymentData, null, 2), "utf8");
  console.log(`\nDeployment metadata recorded to: ${filePath}`);
  console.log("==================================================");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
