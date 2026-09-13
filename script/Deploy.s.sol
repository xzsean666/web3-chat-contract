// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { UserImplementation } from "../src/UserImplementation.sol";
import { GroupImplementation } from "../src/GroupImplementation.sol";
import { RelationshipManager } from "../src/RelationshipManager.sol";
import { ChatStorageFactory } from "../src/ChatStorageFactory.sol";

contract DeployScript is Script {
    function run()
        external
        returns (address userImplAddr, address groupImplAddr, address factoryAddr, address relMgrAddr)
    {
        uint256 deployerPrivateKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );

        vm.startBroadcast(deployerPrivateKey);

        UserImplementation userImpl = new UserImplementation();
        GroupImplementation groupImpl = new GroupImplementation();
        ChatStorageFactory factory = new ChatStorageFactory(address(userImpl), address(groupImpl));
        RelationshipManager relMgr = new RelationshipManager(address(factory));

        factory.setRelationshipManager(address(relMgr));

        vm.stopBroadcast();

        userImplAddr = address(userImpl);
        groupImplAddr = address(groupImpl);
        factoryAddr = address(factory);
        relMgrAddr = address(relMgr);

        console2.log("=== EVM Chat State Storage Protocol Deployment ===");
        console2.log("UserImplementation:", userImplAddr);
        console2.log("GroupImplementation:", groupImplAddr);
        console2.log("ChatStorageFactory:", factoryAddr);
        console2.log("RelationshipManager:", relMgrAddr);
        console2.log("==================================================");
    }
}
