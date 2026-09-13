import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";

describe("Interfaces, Constants and Deployments", () => {
  it("should deploy all core protocol contracts via Viem", async () => {
    const { viem } = await hre.network.getOrCreate();

    const userImpl = await viem.deployContract("UserImplementation");
    const groupImpl = await viem.deployContract("GroupImplementation");
    const factory = await viem.deployContract("ChatStorageFactory", [
      userImpl.address,
      groupImpl.address,
    ]);
    const relMgr = await viem.deployContract("RelationshipManager", [
      factory.address,
    ]);

    assert.ok(userImpl.address, "userImpl should have address");
    assert.ok(groupImpl.address, "groupImpl should have address");
    assert.ok(factory.address, "factory should have address");
    assert.ok(relMgr.address, "relMgr should have address");

    const factoryUserImpl = await factory.read.userImplementation();
    const factoryGroupImpl = await factory.read.groupImplementation();
    assert.strictEqual(factoryUserImpl.toLowerCase(), userImpl.address.toLowerCase());
    assert.strictEqual(factoryGroupImpl.toLowerCase(), groupImpl.address.toLowerCase());
  });

  it("should prevent direct initialization of implementation contracts", async () => {
    const { viem } = await hre.network.getOrCreate();
    const [deployer] = await viem.getWalletClients();

    const userImpl = await viem.deployContract("UserImplementation");
    const groupImpl = await viem.deployContract("GroupImplementation");

    await assert.rejects(async () => {
      await userImpl.write.initialize([
        deployer.account.address,
        deployer.account.address,
        deployer.account.address,
      ]);
    });

    await assert.rejects(async () => {
      await groupImpl.write.initialize([
        1n,
        deployer.account.address,
        "0x",
        [],
        0,
        100,
        deployer.account.address,
      ]);
    });
  });
});
