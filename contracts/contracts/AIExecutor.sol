// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface IINFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function isAuthorized(uint256 tokenId, address executor) external view returns (bool);
    function getMetadataHash(uint256 tokenId) external view returns (bytes32);
}

interface I0GCompute {
    function verifyExecution(
        address provider,
        bytes calldata executionProof
    ) external view returns (bool);
}

/**
 * @title AIExecutor
 * @dev Manages AI agent execution through 0G Compute Network
 */
contract AIExecutor is Ownable, ReentrancyGuard, Pausable {
    // State variables
    IINFT public inftContract;
    address public computeOracle;
    
    // Mapping from executor address to provider address
    mapping(address => address) public executorProviders;
    
    // Mapping from tokenId to execution stats
    mapping(uint256 => ExecutionStats) public agentStats;
    
    // Mapping for execution sessions: sessionId => Session
    mapping(bytes32 => Session) public sessions;
    
    // Fee management
    mapping(address => uint256) public executorBalances;
    uint256 public platformFeePercentage = 100; // 1%
    
    struct ExecutionStats {
        uint256 totalExecutions;
        uint256 totalGasUsed;
        uint256 lastExecutionTime;
    }
    
    struct Session {
        uint256 tokenId;
        address executor;
        address requester;
        uint256 startTime;
        uint256 endTime;
        bytes32 resultHash;
        bool isValid;
        uint256 cost;
    }
    
    // Events
    event ExecutorRegistered(address indexed executor, address indexed provider);
    event SessionStarted(bytes32 indexed sessionId, uint256 indexed tokenId, address executor);
    event SessionCompleted(bytes32 indexed sessionId, bytes32 resultHash, uint256 cost);
    event FundsDeposited(address indexed executor, uint256 amount);
    event FundsWithdrawn(address indexed executor, uint256 amount);
    
    constructor(address _inftContract, address _computeOracle) {
        require(_inftContract != address(0), "Invalid INFT contract");
        require(_computeOracle != address(0), "Invalid compute oracle");
        inftContract = IINFT(_inftContract);
        computeOracle = _computeOracle;
    }
    
    /**
     * @dev Register as an executor with a 0G Compute provider
     * @param provider 0G Compute provider address
     */
    function registerExecutor(address provider) external {
        require(provider != address(0), "Invalid provider");
        executorProviders[msg.sender] = provider;
        emit ExecutorRegistered(msg.sender, provider);
    }
    
    /**
     * @dev Start an AI execution session
     * @param tokenId INFT token ID
     * @param executor Address of the compute executor
     * @param inputHash Hash of the input data
     * @return sessionId Unique session identifier
     */
    function startSession(
        uint256 tokenId,
        address executor,
        bytes32 inputHash
    ) external whenNotPaused returns (bytes32 sessionId) {
        // Verify authorization
        require(
            inftContract.ownerOf(tokenId) == msg.sender || 
            inftContract.isAuthorized(tokenId, msg.sender),
            "Not authorized"
        );
        
        require(executorProviders[executor] != address(0), "Executor not registered");
        
        // Generate session ID
        sessionId = keccak256(abi.encodePacked(
            tokenId,
            msg.sender,
            executor,
            inputHash,
            block.timestamp
        ));
        
        // Create session
        sessions[sessionId] = Session({
            tokenId: tokenId,
            executor: executor,
            requester: msg.sender,
            startTime: block.timestamp,
            endTime: 0,
            resultHash: bytes32(0),
            isValid: false,
            cost: 0
        });
        
        emit SessionStarted(sessionId, tokenId, executor);
        return sessionId;
    }
    
    /**
     * @dev Complete an AI execution session
     * @param sessionId Session identifier
     * @param resultHash Hash of the execution result
     * @param executionProof Proof from 0G Compute
     * @param cost Execution cost in wei
     */
    function completeSession(
        bytes32 sessionId,
        bytes32 resultHash,
        bytes calldata executionProof,
        uint256 cost
    ) external nonReentrant {
        Session storage session = sessions[sessionId];
        require(session.startTime > 0, "Invalid session");
        require(session.endTime == 0, "Session already completed");
        require(session.executor == msg.sender, "Not session executor");
        
        // Verify execution with 0G Compute oracle
        require(
            I0GCompute(computeOracle).verifyExecution(
                executorProviders[msg.sender],
                executionProof
            ),
            "Invalid execution proof"
        );
        
        // Update session
        session.endTime = block.timestamp;
        session.resultHash = resultHash;
        session.isValid = true;
        session.cost = cost;
        
        // Update stats
        ExecutionStats storage stats = agentStats[session.tokenId];
        stats.totalExecutions++;
        stats.totalGasUsed += cost;
        stats.lastExecutionTime = block.timestamp;
        
        // Handle payment
        uint256 platformFee = (cost * platformFeePercentage) / 10000;
        uint256 executorPayment = cost - platformFee;
        
        executorBalances[msg.sender] += executorPayment;
        executorBalances[owner()] += platformFee;
        
        emit SessionCompleted(sessionId, resultHash, cost);
    }
    
    /**
     * @dev Get session result
     * @param sessionId Session identifier
     * @return resultHash Hash of the execution result
     * @return isValid Whether the execution was verified
     */
    function getSessionResult(bytes32 sessionId) 
        external 
        view 
        returns (bytes32 resultHash, bool isValid) 
    {
        Session memory session = sessions[sessionId];
        require(
            session.requester == msg.sender || 
            session.executor == msg.sender,
            "Not authorized"
        );
        
        return (session.resultHash, session.isValid);
    }
    
    /**
     * @dev Deposit funds for execution payments
     */
    function deposit() external payable {
        require(msg.value > 0, "No funds sent");
        executorBalances[msg.sender] += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }
    
    /**
     * @dev Withdraw executor earnings
     */
    function withdraw() external nonReentrant {
        uint256 balance = executorBalances[msg.sender];
        require(balance > 0, "No funds to withdraw");
        
        executorBalances[msg.sender] = 0;
        
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "Transfer failed");
        
        emit FundsWithdrawn(msg.sender, balance);
    }
    
    /**
     * @dev Get agent execution statistics
     * @param tokenId INFT token ID
     * @return stats Execution statistics
     */
    function getAgentStats(uint256 tokenId) 
        external 
        view 
        returns (ExecutionStats memory) 
    {
        return agentStats[tokenId];
    }
    
    /**
     * @dev Check if executor is registered
     * @param executor Address to check
     * @return bool
     */
    function isExecutorRegistered(address executor) 
        external 
        view 
        returns (bool) 
    {
        return executorProviders[executor] != address(0);
    }
    
    /**
     * @dev Update platform fee (owner only)
     * @param newFee New fee percentage (basis points)
     */
    function updatePlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high"); // Max 10%
        platformFeePercentage = newFee;
    }
    
    /**
     * @dev Pause contract (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}