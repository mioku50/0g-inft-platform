// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title AgentModelRegistry
 * @dev Registry for Agent AI model versions and lifecycle management
 * Platform service key acts as owner and attests to training events
 */
contract AgentModelRegistry is Ownable, ReentrancyGuard {
    
    // Events for transparency and tracking
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
        address indexed activatedBy,
        uint256 timestamp
    );
    
    event ConsentRecorded(
        uint256 indexed tokenId,
        address indexed user,
        string consentType,
        bytes32 signatureHash,
        uint256 timestamp
    );

    // Storage mappings
    mapping(uint256 => bytes32) public activeModel;  // tokenId => modelRoot
    mapping(uint256 => uint256) public activeModelTimestamp;  // tokenId => activation timestamp
    mapping(string => TaskInfo) public tasks;  // taskId => TaskInfo
    mapping(uint256 => ModelVersion[]) public modelVersions;  // tokenId => versions array
    mapping(bytes32 => bool) public attestedModels;  // modelRoot => attested
    
    // Structs for data organization
    struct TaskInfo {
        uint256 tokenId;
        address user;
        address provider;
        bytes32 datasetRoot;
        bytes32 pretrainedHash;
        bytes32 trainingParamsHash;
        uint256 createdAt;
        bool delivered;
        bytes32 modelRoot;
        uint256 deliveredAt;
    }
    
    struct ModelVersion {
        bytes32 modelRoot;
        string taskId;
        uint256 createdAt;
        bool isActive;
        bytes32 metricsHash;
        bytes32 logRoot;
    }
    
    // Admin functions - only platform service key can call these
    
    /**
     * @dev Attest that a training task has been created
     * @param tokenId Agent NFT token ID
     * @param user Address of the user who initiated training
     * @param provider Address of the training provider
     * @param datasetRoot Root hash of the training dataset
     * @param pretrainedHash Hash of the pretrained model being fine-tuned
     * @param trainingParamsHash Hash of the training parameters
     * @param taskId Unique identifier for this training task
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
        require(user != address(0), "Invalid user address");
        require(provider != address(0), "Invalid provider address");
        require(datasetRoot != bytes32(0), "Invalid dataset root");
        require(bytes(taskId).length > 0, "Invalid task ID");
        
        // Check if task already exists (idempotency)
        if (tasks[taskId].createdAt != 0) {
            return; // Already exists, safe to return
        }
        
        tasks[taskId] = TaskInfo({
            tokenId: tokenId,
            user: user,
            provider: provider,
            datasetRoot: datasetRoot,
            pretrainedHash: pretrainedHash,
            trainingParamsHash: trainingParamsHash,
            createdAt: block.timestamp,
            delivered: false,
            modelRoot: bytes32(0),
            deliveredAt: 0
        });
        
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
     * @dev Attest that a model has been delivered after training
     * @param taskId The training task ID
     * @param modelRoot Root hash of the delivered model
     * @param metricsHash Hash of training metrics (optional)
     * @param logRoot Root hash of training logs (optional)
     */
    function attestDelivery(
        string calldata taskId,
        bytes32 modelRoot,
        bytes32 metricsHash,
        bytes32 logRoot
    ) external onlyOwner nonReentrant {
        require(bytes(taskId).length > 0, "Invalid task ID");
        require(modelRoot != bytes32(0), "Invalid model root");
        
        TaskInfo storage task = tasks[taskId];
        require(task.createdAt != 0, "Task not found");
        require(!task.delivered, "Already delivered");
        
        // Update task info
        task.delivered = true;
        task.modelRoot = modelRoot;
        task.deliveredAt = block.timestamp;
        
        // Mark model as attested
        attestedModels[modelRoot] = true;
        
        // Add to model versions for this token
        modelVersions[task.tokenId].push(ModelVersion({
            modelRoot: modelRoot,
            taskId: taskId,
            createdAt: block.timestamp,
            isActive: false,
            metricsHash: metricsHash,
            logRoot: logRoot
        }));
        
        emit ModelDelivered(
            task.tokenId,
            task.user,
            task.provider,
            modelRoot,
            metricsHash,
            logRoot,
            taskId,
            block.timestamp
        );
    }
    
    /**
     * @dev Set active model for a token (activate a delivered model)
     * @param tokenId Agent NFT token ID
     * @param modelRoot Root hash of the model to activate
     */
    function setActiveModel(
        uint256 tokenId,
        bytes32 modelRoot
    ) external onlyOwner nonReentrant {
        require(modelRoot != bytes32(0), "Invalid model root");
        require(attestedModels[modelRoot], "Model not attested");
        
        // Deactivate previous active model
        bytes32 previousModel = activeModel[tokenId];
        if (previousModel != bytes32(0)) {
            _deactivateModelVersion(tokenId, previousModel);
        }
        
        // Set new active model
        activeModel[tokenId] = modelRoot;
        activeModelTimestamp[tokenId] = block.timestamp;
        
        // Mark this model version as active
        _activateModelVersion(tokenId, modelRoot);
        
        emit ModelActivated(tokenId, modelRoot, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Record user consent (off-chain signature hash)
     * @param tokenId Agent NFT token ID
     * @param user Address of the user giving consent
     * @param consentType Type of consent (e.g., "fineTune", "activate")
     * @param signatureHash Hash of the off-chain signature
     */
    function recordConsent(
        uint256 tokenId,
        address user,
        string calldata consentType,
        bytes32 signatureHash
    ) external onlyOwner {
        require(user != address(0), "Invalid user address");
        require(bytes(consentType).length > 0, "Invalid consent type");
        require(signatureHash != bytes32(0), "Invalid signature hash");
        
        emit ConsentRecorded(tokenId, user, consentType, signatureHash, block.timestamp);
    }
    
    // View functions - public access for transparency
    
    /**
     * @dev Get active model for a token
     * @param tokenId Agent NFT token ID
     * @return modelRoot Root hash of the active model, or bytes32(0) if none
     */
    function activeModelOf(uint256 tokenId) external view returns (bytes32) {
        return activeModel[tokenId];
    }
    
    /**
     * @dev Get task information
     * @param taskId Training task ID
     * @return task TaskInfo struct with all task details
     */
    function getTask(string calldata taskId) external view returns (TaskInfo memory) {
        return tasks[taskId];
    }
    
    /**
     * @dev Get all model versions for a token
     * @param tokenId Agent NFT token ID
     * @return versions Array of ModelVersion structs
     */
    function getModelVersions(uint256 tokenId) external view returns (ModelVersion[] memory) {
        return modelVersions[tokenId];
    }
    
    /**
     * @dev Get candidate models (delivered but not active) for a token
     * @param tokenId Agent NFT token ID
     * @return candidates Array of candidate ModelVersion structs
     */
    function getCandidateModels(uint256 tokenId) external view returns (ModelVersion[] memory) {
        ModelVersion[] memory allVersions = modelVersions[tokenId];
        uint256 candidateCount = 0;
        
        // Count candidates
        for (uint256 i = 0; i < allVersions.length; i++) {
            if (!allVersions[i].isActive) {
                candidateCount++;
            }
        }
        
        // Build candidates array
        ModelVersion[] memory candidates = new ModelVersion[](candidateCount);
        uint256 candidateIndex = 0;
        
        for (uint256 i = 0; i < allVersions.length; i++) {
            if (!allVersions[i].isActive) {
                candidates[candidateIndex] = allVersions[i];
                candidateIndex++;
            }
        }
        
        return candidates;
    }
    
    /**
     * @dev Check if a model has been attested
     * @param modelRoot Root hash of the model
     * @return isAttested True if the model has been delivered and attested
     */
    function isModelAttested(bytes32 modelRoot) external view returns (bool) {
        return attestedModels[modelRoot];
    }
    
    // Internal helper functions
    
    function _activateModelVersion(uint256 tokenId, bytes32 modelRoot) internal {
        ModelVersion[] storage versions = modelVersions[tokenId];
        for (uint256 i = 0; i < versions.length; i++) {
            if (versions[i].modelRoot == modelRoot) {
                versions[i].isActive = true;
                break;
            }
        }
    }
    
    function _deactivateModelVersion(uint256 tokenId, bytes32 modelRoot) internal {
        ModelVersion[] storage versions = modelVersions[tokenId];
        for (uint256 i = 0; i < versions.length; i++) {
            if (versions[i].modelRoot == modelRoot) {
                versions[i].isActive = false;
                break;
            }
        }
    }
}