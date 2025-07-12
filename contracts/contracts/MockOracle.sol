// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**

- @title MockOracle
- @notice Mock oracle for testing - in production, use real 0G oracle
  */
  contract MockOracle {
  // Mock implementation - always returns true for testing
  function verifyProof(bytes calldata) external pure returns (bool) {
  return true;
  }
  
  // Mock transfer processing
  function processTransfer(
  uint256,
  address,
  address,
  bytes calldata
  ) external pure returns (bytes memory sealedKey, bytes memory proof) {
  // Return mock data for testing
  sealedKey = new bytes(32);
  proof = new bytes(64);
  }
  
  // Mock marketplace transfer processing
  function processTransferForMarketplace(
  uint256,
  address,
  address,
  bytes calldata
  ) external pure returns (bytes memory sealedKey, bytes memory proof) {
  // Return mock data for testing
  sealedKey = new bytes(32);
  proof = new bytes(64);
  }
  }
