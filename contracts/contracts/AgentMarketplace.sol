// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IINFT is IERC721 {
    function transferWithMetadata(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external;
}

/**
 * @title AgentMarketplace
 * @dev Marketplace for buying and selling AI Agent NFTs with secure metadata transfer
 */
contract AgentMarketplace is ReentrancyGuard, Pausable, Ownable {
    // Struct for listings
    struct Listing {
        address seller;
        uint256 price;
        bool isActive;
        string description;
        uint256 listedAt;
    }
    
    // State variables
    IINFT public inftContract;
    uint256 public platformFeePercentage = 250; // 2.5%
    uint256 public constant MAX_FEE = 1000; // 10%
    
    // Mappings
    mapping(uint256 => Listing) public listings;
    mapping(address => uint256) public pendingWithdrawals;
    
    // Events
    event AgentListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event AgentDelisted(uint256 indexed tokenId, address indexed seller);
    event AgentSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event PlatformFeeUpdated(uint256 newFee);
    event FundsWithdrawn(address indexed user, uint256 amount);
    
    constructor(address _inftContract) {
        require(_inftContract != address(0), "Invalid INFT contract");
        inftContract = IINFT(_inftContract);
    }
    
    /**
     * @dev List an AI agent for sale
     * @param tokenId Token ID to list
     * @param price Sale price in wei
     * @param description Description of the agent
     */
    function listAgent(
        uint256 tokenId,
        uint256 price,
        string calldata description
    ) external whenNotPaused {
        require(price > 0, "Price must be greater than 0");
        require(inftContract.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(!listings[tokenId].isActive, "Already listed");
        
        // Check if marketplace is approved
        require(
            inftContract.isApprovedForAll(msg.sender, address(this)) ||
            inftContract.getApproved(tokenId) == address(this),
            "Marketplace not approved"
        );
        
        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            isActive: true,
            description: description,
            listedAt: block.timestamp
        });
        
        emit AgentListed(tokenId, msg.sender, price);
    }
    
    /**
     * @dev Update listing price
     * @param tokenId Token ID
     * @param newPrice New price in wei
     */
    function updatePrice(uint256 tokenId, uint256 newPrice) external {
        require(listings[tokenId].isActive, "Not listed");
        require(listings[tokenId].seller == msg.sender, "Not the seller");
        require(newPrice > 0, "Price must be greater than 0");
        
        listings[tokenId].price = newPrice;
    }
    
    /**
     * @dev Delist an agent
     * @param tokenId Token ID to delist
     */
    function delistAgent(uint256 tokenId) external {
        require(listings[tokenId].isActive, "Not listed");
        require(listings[tokenId].seller == msg.sender, "Not the seller");
        
        delete listings[tokenId];
        emit AgentDelisted(tokenId, msg.sender);
    }
    
    /**
     * @dev Purchase an agent with metadata transfer
     * @param tokenId Token ID to purchase
     * @param sealedKey Sealed encryption key for buyer
     * @param proof Oracle proof for metadata transfer
     */
    function purchaseAgent(
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external payable whenNotPaused nonReentrant {
        Listing memory listing = listings[tokenId];
        require(listing.isActive, "Not for sale");
        require(msg.value >= listing.price, "Insufficient payment");
        require(msg.sender != listing.seller, "Cannot buy own listing");
        
        // Calculate fees
        uint256 platformFee = (listing.price * platformFeePercentage) / 10000;
        uint256 sellerProceeds = listing.price - platformFee;
        
        // Delete listing before transfer
        delete listings[tokenId];
        
        // Transfer the NFT with metadata
        inftContract.transferWithMetadata(
            listing.seller,
            msg.sender,
            tokenId,
            sealedKey,
            proof
        );
        
        // Handle payments
        pendingWithdrawals[listing.seller] += sellerProceeds;
        pendingWithdrawals[owner()] += platformFee;
        
        // Refund excess payment
        if (msg.value > listing.price) {
            pendingWithdrawals[msg.sender] += msg.value - listing.price;
        }
        
        emit AgentSold(tokenId, listing.seller, msg.sender, listing.price);
    }
    
    /**
     * @dev Withdraw pending funds
     */
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        
        pendingWithdrawals[msg.sender] = 0;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit FundsWithdrawn(msg.sender, amount);
    }
    
    /**
     * @dev Update platform fee (owner only)
     * @param newFee New fee percentage (basis points)
     */
    function updatePlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= MAX_FEE, "Fee too high");
        platformFeePercentage = newFee;
        emit PlatformFeeUpdated(newFee);
    }
    
    /**
     * @dev Pause marketplace (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause marketplace (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Get listing details
     * @param tokenId Token ID
     * @return Listing struct
     */
    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }
    
    /**
     * @dev Check if token is listed
     * @param tokenId Token ID
     * @return bool
     */
    function isListed(uint256 tokenId) external view returns (bool) {
        return listings[tokenId].isActive;
    }
}