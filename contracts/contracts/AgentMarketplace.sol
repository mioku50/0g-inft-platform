// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IINFT is IERC721 {
    function secureTransfer(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external;
    
    function getEncryptedURI(uint256 tokenId) external view returns (string memory);
}

interface IOracle {
    function processTransferForMarketplace(
        uint256 tokenId,
        address from,
        address to,
        bytes calldata buyerPublicKey
    ) external returns (bytes memory sealedKey, bytes memory proof);
}

/**
 * @title AgentMarketplace
 * @notice Marketplace for buying and selling AI Agent INFTs
 */
contract AgentMarketplace is ReentrancyGuard, Ownable {
    struct Listing {
        address seller;
        uint256 price;
        bool isActive;
        uint256 listedAt;
    }
    
    // State variables
    IINFT public inftContract;
    IOracle public oracle;
    uint256 public marketplaceFee = 250; // 2.5% fee (250 / 10000)
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    mapping(uint256 => Listing) public listings;
    mapping(address => uint256) public pendingWithdrawals;
    
    // Events
    event AgentListed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );
    
    event AgentSold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price
    );
    
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event ListingUpdated(uint256 indexed tokenId, uint256 newPrice);
    event FeeUpdated(uint256 newFee);
    event Withdrawal(address indexed user, uint256 amount);
    
    constructor(address _inftContract, address _oracle) {
        inftContract = IINFT(_inftContract);
        oracle = IOracle(_oracle);
    }
    
    /**
     * @notice List an AI agent for sale
     * @param tokenId The INFT token ID
     * @param price The sale price in wei
     */
    function listAgent(uint256 tokenId, uint256 price) external nonReentrant {
        require(price > 0, "Price must be greater than 0");
        require(inftContract.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(!listings[tokenId].isActive, "Already listed");
        
        // Check marketplace has approval
        require(
            inftContract.getApproved(tokenId) == address(this) ||
            inftContract.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );
        
        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            isActive: true,
            listedAt: block.timestamp
        });
        
        emit AgentListed(tokenId, msg.sender, price);
    }
    
    /**
     * @notice Update listing price
     * @param tokenId The INFT token ID
     * @param newPrice The new price in wei
     */
    function updateListing(uint256 tokenId, uint256 newPrice) external {
        require(newPrice > 0, "Price must be greater than 0");
        require(listings[tokenId].isActive, "Not listed");
        require(listings[tokenId].seller == msg.sender, "Not the seller");
        
        listings[tokenId].price = newPrice;
        
        emit ListingUpdated(tokenId, newPrice);
    }
    
    /**
     * @notice Cancel a listing
     * @param tokenId The INFT token ID
     */
    function cancelListing(uint256 tokenId) external {
        require(listings[tokenId].isActive, "Not listed");
        require(listings[tokenId].seller == msg.sender, "Not the seller");
        
        delete listings[tokenId];
        
        emit ListingCancelled(tokenId, msg.sender);
    }
    
    /**
     * @notice Purchase an AI agent
     * @param tokenId The INFT token ID
     * @param buyerPublicKey Optional public key for secure transfer
     */
    function purchaseAgent(
        uint256 tokenId,
        bytes calldata buyerPublicKey
    ) external payable nonReentrant {
        Listing memory listing = listings[tokenId];
        require(listing.isActive, "Not listed");
        require(msg.value >= listing.price, "Insufficient payment");
        require(msg.sender != listing.seller, "Cannot buy own listing");
        
        // Verify seller still owns the token
        require(inftContract.ownerOf(tokenId) == listing.seller, "Seller no longer owns token");
        
        // Calculate fees
        uint256 fee = (listing.price * marketplaceFee) / FEE_DENOMINATOR;
        uint256 sellerProceeds = listing.price - fee;
        
        // Remove listing
        delete listings[tokenId];
        
        // Process secure transfer through oracle
        (bytes memory sealedKey, bytes memory proof) = oracle.processTransferForMarketplace(
            tokenId,
            listing.seller,
            msg.sender,
            buyerPublicKey
        );
        
        // Execute the transfer
        inftContract.secureTransfer(
            listing.seller,
            msg.sender,
            tokenId,
            sealedKey,
            proof
        );
        
        // Handle payments
        pendingWithdrawals[listing.seller] += sellerProceeds;
        pendingWithdrawals[owner()] += fee;
        
        // Refund excess payment
        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }
        
        emit AgentSold(tokenId, listing.seller, msg.sender, listing.price);
    }
    
    /**
     * @notice Withdraw pending funds
     */
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No funds to withdraw");
        
        pendingWithdrawals[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        
        emit Withdrawal(msg.sender, amount);
    }
    
    /**
     * @notice Get listing details
     * @param tokenId The INFT token ID
     */
    function getListing(uint256 tokenId) external view returns (
        address seller,
        uint256 price,
        bool isActive,
        uint256 listedAt
    ) {
        Listing memory listing = listings[tokenId];
        return (listing.seller, listing.price, listing.isActive, listing.listedAt);
    }
    
    /**
     * @notice Get multiple listings
     * @param tokenIds Array of token IDs
     */
    function getListings(uint256[] calldata tokenIds) external view returns (Listing[] memory) {
        Listing[] memory result = new Listing[](tokenIds.length);
        for (uint i = 0; i < tokenIds.length; i++) {
            result[i] = listings[tokenIds[i]];
        }
        return result;
    }
    
    /**
     * @notice Check if token is listed
     * @param tokenId The INFT token ID
     */
    function isListed(uint256 tokenId) external view returns (bool) {
        return listings[tokenId].isActive;
    }
    
    /**
     * @notice Update marketplace fee (owner only)
     * @param newFee New fee in basis points (e.g., 250 = 2.5%)
     */
    function setMarketplaceFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high"); // Max 10%
        marketplaceFee = newFee;
        emit FeeUpdated(newFee);
    }
    
    /**
     * @notice Update oracle address (owner only)
     * @param newOracle New oracle address
     */
    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle");
        oracle = IOracle(newOracle);
    }
    
    /**
     * @notice Emergency pause - remove a listing (owner only)
     * @param tokenId The INFT token ID
     */
    function emergencyDelistToken(uint256 tokenId) external onlyOwner {
        require(listings[tokenId].isActive, "Not listed");
        
        address seller = listings[tokenId].seller;
        delete listings[tokenId];
        
        emit ListingCancelled(tokenId, seller);
    }
}

// ===================================
// contracts/contracts/MockOracle.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockOracle
 * @notice Mock oracle for testing - in production, use real 0G oracle
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