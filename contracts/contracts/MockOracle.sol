// contracts/contracts/MockOracle.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockOracle {
    // For testing, always return true
    function verifyProof(bytes calldata) external pure returns (bool) {
        return true;
    }
    
    function verifySealedKey(bytes calldata, address) external pure returns (bool) {
        return true;
    }
    
    function generateProof(
        bytes32 oldHash,
        bytes32 newHash,
        address recipient
    ) external pure returns (bytes memory) {
        return abi.encodePacked(newHash, oldHash, recipient);
    }
}