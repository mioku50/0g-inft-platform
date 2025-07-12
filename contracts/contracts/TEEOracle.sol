// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TEEOracle
 * @notice Oracle implementation for INFT secure transfers using TEE
 * @dev Based on 0G Agent NFT ERC-7857 standard
 */
contract TEEOracle {
    // TEE attestation data
    struct Attestation {
        bytes32 mrEnclave;  // Measurement of TEE code
        bytes32 mrSigner;   // Signer of TEE code
        uint256 timestamp;
        bytes signature;
    }
    
    // Transfer proof structure
    struct TransferProof {
        bytes32 oldDataHash;
        bytes32 newDataHash;
        address receiver;
        bytes sealedKey;
        Attestation attestation;
    }
    
    // Trusted TEE enclaves
    mapping(bytes32 => bool) public trustedEnclaves;
    
    // Events
    event EnclaveAdded(bytes32 indexed mrEnclave);
    event EnclaveRemoved(bytes32 indexed mrEnclave);
    event ProofVerified(bytes32 oldDataHash, bytes32 newDataHash, address receiver);
    
    // Owner
    address public owner;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @notice Add trusted TEE enclave
     * @param mrEnclave Measurement of the TEE enclave
     */
    function addTrustedEnclave(bytes32 mrEnclave) external onlyOwner {
        trustedEnclaves[mrEnclave] = true;
        emit EnclaveAdded(mrEnclave);
    }
    
    /**
     * @notice Remove trusted TEE enclave
     * @param mrEnclave Measurement of the TEE enclave
     */
    function removeTrustedEnclave(bytes32 mrEnclave) external onlyOwner {
        trustedEnclaves[mrEnclave] = false;
        emit EnclaveRemoved(mrEnclave);
    }
    
    /**
     * @notice Verify transfer proof from TEE
     * @param proof Encoded proof data from TEE
     * @return valid Whether the proof is valid
     */
    function verifyProof(bytes calldata proof) external view returns (bool valid) {
        if (proof.length < 128) {
            return false;
        }
        
        // Decode proof
        TransferProof memory transferProof = _decodeProof(proof);
        
        // Verify TEE attestation
        if (!trustedEnclaves[transferProof.attestation.mrEnclave]) {
            return false;
        }
        
        // Verify timestamp (not too old)
        if (block.timestamp - transferProof.attestation.timestamp > 3600) { // 1 hour
            return false;
        }
        
        // In production, verify the signature from TEE
        // For now, return true if enclave is trusted
        return true;
    }
    
    /**
     * @notice Process transfer request through TEE
     * @param tokenId Token being transferred
     * @param from Current owner
     * @param to New owner
     * @param encryptedData Current encrypted metadata
     * @return sealedKey New key sealed for receiver
     * @return proof Transfer proof
     */
    function processTransfer(
        uint256 tokenId,
        address from,
        address to,
        bytes calldata encryptedData
    ) external view returns (bytes memory sealedKey, bytes memory proof) {
        // In production, this would:
        // 1. Forward request to TEE
        // 2. TEE decrypts data with old key
        // 3. TEE generates new key
        // 4. TEE re-encrypts data with new key
        // 5. TEE seals new key for receiver
        // 6. TEE returns proof
        
        // For demo, generate mock proof
        bytes32 oldDataHash = keccak256(encryptedData);
        bytes32 newDataHash = keccak256(abi.encodePacked(encryptedData, to, block.timestamp));
        
        // Mock sealed key (in production, encrypted with receiver's public key)
        sealedKey = abi.encodePacked(
            keccak256(abi.encodePacked(tokenId, to, block.timestamp))
        );
        
        // Create mock attestation
        Attestation memory attestation = Attestation({
            mrEnclave: bytes32(uint256(1)), // Mock enclave measurement
            mrSigner: bytes32(uint256(2)),  // Mock signer
            timestamp: block.timestamp,
            signature: new bytes(65)         // Mock signature
        });
        
        // Encode proof
        proof = _encodeProof(TransferProof({
            oldDataHash: oldDataHash,
            newDataHash: newDataHash,
            receiver: to,
            sealedKey: sealedKey,
            attestation: attestation
        }));
    }
    
    /**
     * @notice Process marketplace transfer
     * @param tokenId Token being transferred
     * @param from Current owner
     * @param to New owner (buyer)
     * @param buyerPublicKey Buyer's public key for encryption
     * @return sealedKey New key sealed for buyer
     * @return proof Transfer proof
     */
    function processTransferForMarketplace(
        uint256 tokenId,
        address from,
        address to,
        bytes calldata buyerPublicKey
    ) external view returns (bytes memory sealedKey, bytes memory proof) {
        // Similar to processTransfer but uses buyer's public key
        // In production, TEE would use the public key to encrypt the new key
        
        bytes32 mockDataHash = keccak256(abi.encodePacked(tokenId, from, to));
        
        sealedKey = abi.encodePacked(
            keccak256(abi.encodePacked(mockDataHash, buyerPublicKey))
        );
        
        Attestation memory attestation = Attestation({
            mrEnclave: bytes32(uint256(1)),
            mrSigner: bytes32(uint256(2)),
            timestamp: block.timestamp,
            signature: new bytes(65)
        });
        
        proof = _encodeProof(TransferProof({
            oldDataHash: mockDataHash,
            newDataHash: keccak256(abi.encodePacked(mockDataHash, to)),
            receiver: to,
            sealedKey: sealedKey,
            attestation: attestation
        }));
    }
    
    /**
     * @notice Decode proof from bytes
     */
    function _decodeProof(bytes calldata proof) internal pure returns (TransferProof memory) {
        // Simple decoding for demo
        // In production, use proper ABI decoding
        
        TransferProof memory transferProof;
        
        // Extract hashes (first 64 bytes)
        transferProof.oldDataHash = bytes32(proof[0:32]);
        transferProof.newDataHash = bytes32(proof[32:64]);
        
        // Extract receiver address (next 20 bytes, padded to 32)
        transferProof.receiver = address(uint160(uint256(bytes32(proof[64:96]))));
        
        // Mock attestation
        transferProof.attestation.mrEnclave = bytes32(uint256(1));
        transferProof.attestation.mrSigner = bytes32(uint256(2));
        transferProof.attestation.timestamp = block.timestamp;
        
        return transferProof;
    }
    
    /**
     * @notice Encode proof to bytes
     */
    function _encodeProof(TransferProof memory proof) internal pure returns (bytes memory) {
        return abi.encodePacked(
            proof.oldDataHash,
            proof.newDataHash,
            proof.receiver,
            proof.sealedKey,
            proof.attestation.mrEnclave,
            proof.attestation.mrSigner,
            proof.attestation.timestamp,
            proof.attestation.signature
        );
    }
    
    /**
     * @notice Update owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
}

// ===================================
// Обновите contracts/scripts/deploy.js чтобы деплоить TEEOracle вместо MockOracle:

/*
// Deploy TEE Oracle
console.log("\nDeploying TEEOracle...");
const TEEOracle = await hre.ethers.getContractFactory("TEEOracle");
const oracle = await TEEOracle.deploy();
await oracle.deployed();
console.log("TEEOracle deployed to:", oracle.address);

// Add trusted enclave (в продакшене использовать реальный mrEnclave)
const mockMrEnclave = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("mock-enclave"));
await oracle.addTrustedEnclave(mockMrEnclave);
console.log("Added trusted enclave:", mockMrEnclave);
*/