// SPDX-License-Identifier: MIT
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  ChatStorageFactoryABI,
  GroupImplementationABI,
  RelationshipManagerABI,
  UserImplementationABI,
} from "../../src";

export const anvilChain = defineChain({
  id: 31337,
  name: "Anvil Localhost",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
});

function loadBytecode(contractName: string): Hex {
  const root = resolve(__dirname, "../../../");
  const p = resolve(root, `out/${contractName}.sol/${contractName}.json`);
  const data = JSON.parse(readFileSync(p, "utf8"));
  return data.bytecode.object as Hex;
}

export interface DeployedContracts {
  userImpl: Address;
  groupImpl: Address;
  factory: Address;
  relMgr: Address;
  publicClient: PublicClient;
  deployerWallet: WalletClient;
}

export async function deployLocalProtocol(rpcUrl = "http://127.0.0.1:8545"): Promise<DeployedContracts> {
  const deployerAccount = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );

  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: anvilChain, transport });
  const deployerWallet = createWalletClient({
    account: deployerAccount,
    chain: anvilChain,
    transport,
  });

  // 1. Deploy UserImplementation
  const userImplHash = await deployerWallet.deployContract({
    abi: UserImplementationABI,
    bytecode: loadBytecode("UserImplementation"),
  });
  const userImplReceipt = await publicClient.waitForTransactionReceipt({ hash: userImplHash });
  const userImpl = userImplReceipt.contractAddress!;

  // 2. Deploy GroupImplementation
  const groupImplHash = await deployerWallet.deployContract({
    abi: GroupImplementationABI,
    bytecode: loadBytecode("GroupImplementation"),
  });
  const groupImplReceipt = await publicClient.waitForTransactionReceipt({ hash: groupImplHash });
  const groupImpl = groupImplReceipt.contractAddress!;

  // 3. Deploy ChatStorageFactory
  const factoryHash = await deployerWallet.deployContract({
    abi: ChatStorageFactoryABI,
    bytecode: loadBytecode("ChatStorageFactory"),
    args: [userImpl, groupImpl],
  });
  const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryHash });
  const factory = factoryReceipt.contractAddress!;

  // 4. Deploy RelationshipManager
  const relMgrHash = await deployerWallet.deployContract({
    abi: RelationshipManagerABI,
    bytecode: loadBytecode("RelationshipManager"),
    args: [factory],
  });
  const relMgrReceipt = await publicClient.waitForTransactionReceipt({ hash: relMgrHash });
  const relMgr = relMgrReceipt.contractAddress!;

  // 5. Configure RelationshipManager on Factory
  const setRelHash = await deployerWallet.writeContract({
    address: factory,
    abi: ChatStorageFactoryABI,
    functionName: "setRelationshipManager",
    args: [relMgr],
  });
  await publicClient.waitForTransactionReceipt({ hash: setRelHash });

  return {
    userImpl,
    groupImpl,
    factory,
    relMgr,
    publicClient,
    deployerWallet,
  };
}
