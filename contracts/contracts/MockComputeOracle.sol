// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockComputeOracle
 * @dev Test oracle for 0G Compute integration
 * @notice In production, this should be replaced with actual 0G Compute verification
 */
contract MockComputeOracle {
    // Mapping to store execution validity (for testing)
    mapping(bytes32 => bool) public executionValidity;
    
    // Owner address
    address public owner;
    
    // Official 0G Compute providers (from documentation)
    mapping(address => bool) public officialProviders;
    
    // Events
    event ExecutionVerified(address indexed provider, bytes32 indexed proofHash);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    
    constructor() {
        owner = msg.sender;
        
        // Add official 0G providers from documentation
        officialProviders[0xf07240Efa67755B5311bc75784a061eDB47165Dd] = true; // llama-3.3-70b
        officialProviders[0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3] = true; // deepseek-r1-70b
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    /**
     * @dev Verify execution proof from 0G Compute
     * @param provider The compute provider address
     * @param executionProof The proof data to verify
     * @return bool Whether the execution is valid
     */
    function verifyExecution(
        address provider,
        bytes calldata executionProof
    ) external view returns (bool) {
        // Check if provider is official
        if (!officialProviders[provider]) {
            return false;
        }
        
        // In production, this would verify TEE signatures
        // For testing, check pre-set validity or return true for official providers
        bytes32 proofHash = keccak256(executionProof);
        
        if (executionValidity[proofHash]) {
            return true;
        }
        
        // Default to true for testing with official providers
        return officialProviders[provider];
    }
    
    /**
     * @dev Set execution validity for testing
     * @param executionProof The proof data
     * @param isValid Whether the proof should be considered valid
     */
    function setExecutionValidity(
        bytes calldata executionProof,
        bool isValid
    ) external onlyOwner {
        bytes32 proofHash = keccak256(executionProof);
        executionValidity[proofHash] = isValid;
    }
    
    /**
     * @dev Add official provider
     * @param provider Provider address to add
     */
    function addProvider(address provider) external onlyOwner {
        officialProviders[provider] = true;
        emit ProviderAdded(provider);
    }
    
    /**
     * @dev Remove official provider
     * @param provider Provider address to remove
     */
    function removeProvider(address provider) external onlyOwner {
        officialProviders[provider] = false;
        emit ProviderRemoved(provider);
    }
    
    /**
     * @dev Check if provider is official
     * @param provider Provider address to check
     * @return bool
     */
    function isOfficialProvider(address provider) external view returns (bool) {
        return officialProviders[provider];
    }
    
    /**
     * @dev Generate mock execution proof for testing
     * @param sessionId Session identifier
     * @param resultHash Result of computation
     * @param provider Provider address
     * @return proof Mock proof data
     */
    function generateMockProof(
        bytes32 sessionId,
        bytes32 resultHash,
        address provider
    ) external view returns (bytes memory proof) {
        // Concatenate data to create mock proof
        proof = abi.encodePacked(
            sessionId,
            resultHash,
            provider,
            block.timestamp,
            "MOCK_TEE_SIGNATURE"
        );
        return proof;
    }
}