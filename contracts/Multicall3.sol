// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Multicall3
/// @notice Aggregate results from multiple function calls
contract Multicall3 {
    struct Call {
        address target;
        bytes callData;
    }

    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Call3Value {
        address target;
        bool allowFailure;
        uint256 value;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    function aggregate(Call[] calldata calls) public payable returns (uint256 blockNumber, bytes[] memory returnData) {
        blockNumber = block.number;
        returnData = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory ret) = calls[i].target.call(calls[i].callData);
            require(success, "Multicall3: call failed");
            returnData[i] = ret;
        }
    }

    function aggregate3(Call3[] calldata calls) public payable returns (Result[] memory returnData) {
        returnData = new Result[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            Result memory result = returnData[i];
            (result.success, result.returnData) = calls[i].target.call(calls[i].callData);
            if (!calls[i].allowFailure) {
                require(result.success, "Multicall3: call failed");
            }
        }
    }

    function aggregate3Value(Call3Value[] calldata calls) public payable returns (Result[] memory returnData) {
        returnData = new Result[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            Result memory result = returnData[i];
            (result.success, result.returnData) = calls[i].target.call{value: calls[i].value}(calls[i].callData);
            if (!calls[i].allowFailure) {
                require(result.success, "Multicall3: call failed");
            }
        }
    }

    function blockAndAggregate(Call[] calldata calls) public payable returns (uint256 blockNumber, bytes32 blockHash, Result[] memory returnData) {
        blockNumber = block.number;
        blockHash = blockhash(block.number);
        returnData = new Result[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            Result memory result = returnData[i];
            (result.success, result.returnData) = calls[i].target.call(calls[i].callData);
        }
    }

    function getBasefee() public view returns (uint256) {
        return block.basefee;
    }

    function getBlockHash(uint256 blockNumber) public view returns (bytes32) {
        return blockhash(blockNumber);
    }

    function getBlockNumber() public view returns (uint256) {
        return block.number;
    }

    function getChainId() public view returns (uint256) {
        return block.chainid;
    }

    function getCurrentBlockCoinbase() public view returns (address) {
        return block.coinbase;
    }

    function getCurrentBlockDifficulty() public view returns (uint256) {
        return block.prevrandao;
    }

    function getCurrentBlockGasLimit() public view returns (uint256) {
        return block.gaslimit;
    }

    function getCurrentBlockTimestamp() public view returns (uint256) {
        return block.timestamp;
    }

    function getEthBalance(address addr) public view returns (uint256 balance) {
        return addr.balance;
    }

    function getLastBlockHash() public view returns (bytes32) {
        return blockhash(block.number - 1);
    }

    function tryAggregate(bool requireSuccess, Call[] calldata calls) public payable returns (Result[] memory returnData) {
        returnData = new Result[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            Result memory result = returnData[i];
            (result.success, result.returnData) = calls[i].target.call(calls[i].callData);
            if (requireSuccess) {
                require(result.success, "Multicall3: call failed");
            }
        }
    }

    function tryBlockAndAggregate(bool requireSuccess, Call[] calldata calls) public payable returns (uint256 blockNumber, bytes32 blockHash, Result[] memory returnData) {
        blockNumber = block.number;
        blockHash = blockhash(block.number);
        returnData = tryAggregate(requireSuccess, calls);
    }
}
