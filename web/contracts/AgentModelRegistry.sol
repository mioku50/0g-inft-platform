// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title AgentModelRegistry
 * @dev Registry contract for AI agent model training attestations and versioning
 * Platform pays gas for users but creates transparent on-chain attestations
 */
contract AgentModelRegistry is Ownable, ReentrancyGuard {
    // Events for on-chain attestations
    event TaskCreated(
        uint256 indexed tokenId,
        address indexed user,
        address indexed provider,
        bytes32 datasetRoot,
        bytes32 pretrainedHash,
        bytes32 trainingParamsHash,
        string taskId,
        uint256 timestamp
    );

    event ModelDelivered(
        uint256 indexed tokenId,
        address indexed user,
        address indexed provider,
        bytes32 modelRoot,
        bytes32 metricsHash,
        bytes32 logRoot,
        string taskId,
        uint256 timestamp
    );

    event ModelActivated(
        uint256 indexed tokenId,
        bytes32 indexed modelRoot,
        address indexed by,
        uint256 timestamp
    );

    // Storage
    mapping(uint256 => bytes32) public activeModelOf;
    mapping(uint256 => mapping(bytes32 => bool)) public deliveredModels;
    mapping(string => bool) public processedTasks;
    
    // Model version tracking
    struct ModelVersion {
        bytes32 modelRoot;
        address user;
        address provider;
        string taskId;
        uint256 deliveredAt;
        uint256 activatedAt;
        bool isActive;
    }
    
    mapping(uint256 => ModelVersion[]) public modelVersions;
    mapping(uint256 => uint256) public activeVersionIndex;

    /**
     * @dev Attest the creation of a fine-tuning task
     * Only callable by contract owner (platform)
     */
    function attestTask(
        uint256 tokenId,
        address user,
        address provider,
        bytes32 datasetRoot,
        bytes32 pretrainedHash,
        bytes32 trainingParamsHash,
        string calldata taskId
    ) external onlyOwner nonReentrant {
        require(!processedTasks[taskId], "Task already processed");
        require(user != address(0), "Invalid user address");
        require(provider != address(0), "Invalid provider address");
        
        processedTasks[taskId] = true;
        
        emit TaskCreated(
            tokenId,
            user,
            provider,
            datasetRoot,
            pretrainedHash,
            trainingParamsHash,
            taskId,
            block.timestamp
        );
    }

    /**
     * @dev Attest the delivery of a trained model
     * Only callable by contract owner (platform)
     */
    function attestDelivery(
        uint256 tokenId,
        address user,
        address provider,
        bytes32 modelRoot,
        bytes32 metricsHash,
        bytes32 logRoot,
        string calldata taskId
    ) external onlyOwner nonReentrant {
        require(processedTasks[taskId], "Task not found");
        require(user != address(0), "Invalid user address");
        require(provider != address(0), "Invalid provider address");
        require(modelRoot != bytes32(0), "Invalid model root");
        require(!deliveredModels[tokenId][modelRoot], "Model already delivered");
        
        deliveredModels[tokenId][modelRoot] = true;
        
        // Add to version history
        modelVersions[tokenId].push(ModelVersion({
            modelRoot: modelRoot,
            user: user,
            provider: provider,
            taskId: taskId,
            deliveredAt: block.timestamp,
            activatedAt: 0,
            isActive: false
        }));
        
        emit ModelDelivered(
            tokenId,
            user,
            provider,
            modelRoot,
            metricsHash,
            logRoot,
            taskId,
            block.timestamp
        );
    }

    /**
     * @dev Set active model for an agent token
     * Only callable by contract owner (platform)
     */
    function setActiveModel(
        uint256 tokenId,
        bytes32 modelRoot,
        address by
    ) external onlyOwner nonReentrant {
        require(deliveredModels[tokenId][modelRoot], "Model not delivered");
        require(by != address(0), "Invalid address");
        
        // Update active model
        activeModelOf[tokenId] = modelRoot;
        
        // Update version history
        ModelVersion[] storage versions = modelVersions[tokenId];
        for (uint256 i = 0; i < versions.length; i++) {
            if (versions[i].modelRoot == modelRoot) {
                // Deactivate previous active version
                if (activeVersionIndex[tokenId] < versions.length) {
                    versions[activeVersionIndex[tokenId]].isActive = false;
                }
                
                // Activate new version
                versions[i].isActive = true;
                versions[i].activatedAt = block.timestamp;
                activeVersionIndex[tokenId] = i;
                break;
            }
        }
        
        emit ModelActivated(tokenId, modelRoot, by, block.timestamp);
    }

    /**
     * @dev Get active model for a token
     */
    function getActiveModel(uint256 tokenId) external view returns (bytes32) {
        return activeModelOf[tokenId];
    }

    /**
     * @dev Get all model versions for a token
     */
    function getModelVersions(uint256 tokenId) external view returns (ModelVersion[] memory) {
        return modelVersions[tokenId];
    }

    /**
     * @dev Get number of model versions for a token
     */
    function getVersionCount(uint256 tokenId) external view returns (uint256) {
        return modelVersions[tokenId].length;
    }

    /**
     * @dev Get specific model version
     */
    function getModelVersion(uint256 tokenId, uint256 versionIndex) 
        external 
        view 
        returns (ModelVersion memory) 
    {
        require(versionIndex < modelVersions[tokenId].length, "Version not found");
        return modelVersions[tokenId][versionIndex];
    }

    /**
     * @dev Check if model was delivered for token
     */
    function isModelDelivered(uint256 tokenId, bytes32 modelRoot) external view returns (bool) {
        return deliveredModels[tokenId][modelRoot];
    }

    /**
     * @dev Check if task was processed
     */
    function isTaskProcessed(string calldata taskId) external view returns (bool) {
        return processedTasks[taskId];
    }

    /**
     * @dev Get latest candidate model (delivered but not active)
     */
    function getCandidateModel(uint256 tokenId) external view returns (bytes32, bool) {
        ModelVersion[] storage versions = modelVersions[tokenId];
        if (versions.length == 0) return (bytes32(0), false);
        
        // Find the latest delivered but non-active model
        for (uint256 i = versions.length; i > 0; i--) {
            uint256 idx = i - 1;
            if (!versions[idx].isActive && versions[idx].deliveredAt > 0) {
                return (versions[idx].modelRoot, true);
            }
        }
        
        return (bytes32(0), false);
    }
}