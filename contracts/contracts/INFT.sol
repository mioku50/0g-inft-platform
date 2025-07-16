// contracts/contracts/INFT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

interface IOracle {
    function verifyProof(bytes calldata proof) external view returns (bool);
    function verifySealedKey(bytes calldata sealedKey, address recipient) external view returns (bool);
}

/**
 * @title INFT - Intelligent NFT for AI Agents on 0G
 * @dev Full implementation with ERC721Enumerable and advanced features
 */
contract INFT is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;
    
    // State variables
    Counters.Counter private _tokenIdCounter;
    
    // Oracle for TEE verification
    address public oracle;
    
    // Mapping from token ID to metadata hash
    mapping(uint256 => bytes32) private _metadataHashes;
    
    // Mapping from token ID to encrypted URI (0G Storage)
    mapping(uint256 => string) private _encryptedURIs;
    
    // Mapping for usage authorizations
    mapping(uint256 => mapping(address => bytes)) private _authorizations;
    
    // Mapping for sealed keys (for metadata access)
    mapping(uint256 => mapping(address => bytes)) private _sealedKeys;
    
    // Events
    event AgentMinted(uint256 indexed tokenId, address indexed owner, string encryptedURI);
    event MetadataUpdated(uint256 indexed tokenId, bytes32 newHash);
    event UsageAuthorized(uint256 indexed tokenId, address indexed executor);
    event UsageRevoked(uint256 indexed tokenId, address indexed executor);
    event AgentCloned(uint256 indexed originalTokenId, uint256 indexed newTokenId, address indexed owner);
    event TransferWithMetadata(uint256 indexed tokenId, address indexed from, address indexed to);
    
    constructor(
        string memory name,
        string memory symbol,
        address _oracle
    ) ERC721(name, symbol) {
        require(_oracle != address(0), "Invalid oracle address");
        oracle = _oracle;
        _tokenIdCounter.increment(); // Start from token ID 1
    }
    
    /**
     * @dev Mint a new AI agent NFT (public function)
     * @param to Address to mint to
     * @param encryptedURI Encrypted URI pointing to 0G Storage
     * @param metadataHash Hash of the encrypted metadata
     */
    function mint(
        address to,
        string calldata encryptedURI,
        bytes32 metadataHash
    ) external whenNotPaused returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(bytes(encryptedURI).length > 0, "URI cannot be empty");
        require(metadataHash != bytes32(0), "Invalid metadata hash");
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, encryptedURI);
        
        _encryptedURIs[tokenId] = encryptedURI;
        _metadataHashes[tokenId] = metadataHash;
        
        emit AgentMinted(tokenId, to, encryptedURI);
        
        return tokenId;
    }
    
    /**
     * @dev Transfer with metadata re-encryption
     * @param from Current owner
     * @param to New owner
     * @param tokenId Token to transfer
     * @param sealedKey New sealed key for recipient
     * @param proof TEE proof of correct re-encryption
     */
    function transferWithMetadata(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external nonReentrant {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "Not authorized");
        require(ownerOf(tokenId) == from, "From is not owner");
        require(to != address(0), "Cannot transfer to zero address");
        require(IOracle(oracle).verifyProof(proof), "Invalid proof");
        require(IOracle(oracle).verifySealedKey(sealedKey, to), "Invalid sealed key");
        
        // Store sealed key for new owner
        _sealedKeys[tokenId][to] = sealedKey;
        
        // Update metadata hash if provided in proof
        if (proof.length >= 32) {
            bytes32 newHash = bytes32(proof[0:32]);
            _metadataHashes[tokenId] = newHash;
            emit MetadataUpdated(tokenId, newHash);
        }
        
        // Transfer the token
        _transfer(from, to, tokenId);
        
        emit TransferWithMetadata(tokenId, from, to);
    }
    
    /**
     * @dev Clone an AI agent (create a copy with same metadata)
     * @param tokenId Token to clone
     * @param to Address to mint clone to
     * @param sealedKey Sealed key for clone recipient
     * @param proof TEE proof of correct cloning
     */
    function clone(
        uint256 tokenId,
        address to,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(_exists(tokenId), "Token does not exist");
        require(to != address(0), "Cannot clone to zero address");
        require(
            ownerOf(tokenId) == _msgSender() || 
            _authorizations[tokenId][_msgSender()].length > 0,
            "Not authorized to clone"
        );
        require(IOracle(oracle).verifyProof(proof), "Invalid proof");
        
        uint256 newTokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        // Mint new token
        _safeMint(to, newTokenId);
        
        // Copy metadata
        _encryptedURIs[newTokenId] = _encryptedURIs[tokenId];
        _metadataHashes[newTokenId] = _metadataHashes[tokenId];
        _setTokenURI(newTokenId, _encryptedURIs[tokenId]);
        
        // Store sealed key for clone owner
        _sealedKeys[newTokenId][to] = sealedKey;
        
        emit AgentCloned(tokenId, newTokenId, to);
        emit AgentMinted(newTokenId, to, _encryptedURIs[tokenId]);
        
        return newTokenId;
    }
    
    /**
     * @dev Authorize usage of AI agent without transferring ownership
     * @param tokenId Token to authorize
     * @param executor Address to authorize
     * @param permissions Encoded permissions
     */
    function authorizeUsage(
        uint256 tokenId,
        address executor,
        bytes calldata permissions
    ) external {
        require(ownerOf(tokenId) == _msgSender(), "Not owner");
        require(executor != address(0), "Invalid executor");
        
        _authorizations[tokenId][executor] = permissions;
        emit UsageAuthorized(tokenId, executor);
    }
    
    /**
     * @dev Revoke usage authorization
     * @param tokenId Token ID
     * @param executor Address to revoke
     */
    function revokeUsage(uint256 tokenId, address executor) external {
        require(ownerOf(tokenId) == _msgSender(), "Not owner");
        
        delete _authorizations[tokenId][executor];
        emit UsageRevoked(tokenId, executor);
    }
    
    // View functions
    
    function getMetadataHash(uint256 tokenId) external view returns (bytes32) {
        require(_exists(tokenId), "Token does not exist");
        return _metadataHashes[tokenId];
    }
    
    function getEncryptedURI(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return _encryptedURIs[tokenId];
    }
    
    function isAuthorized(uint256 tokenId, address executor) external view returns (bool) {
        return _authorizations[tokenId][executor].length > 0;
    }
    
    function getAuthorization(uint256 tokenId, address executor) external view returns (bytes memory) {
        return _authorizations[tokenId][executor];
    }
    
    function getSealedKey(uint256 tokenId, address user) external view returns (bytes memory) {
        require(
            ownerOf(tokenId) == user || 
            _authorizations[tokenId][user].length > 0,
            "Not authorized"
        );
        return _sealedKeys[tokenId][user];
    }
    
    // Admin functions
    
    function updateOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        oracle = newOracle;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Override functions
    
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        
        // Clear authorizations on transfer
        if (from != address(0) && to != address(0) && from != to) {
            // Get all previous authorizations and clear them
            // Note: In production, you'd want to track authorized addresses
            // to efficiently clear them
        }
    }
    
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
        
        // Clear metadata
        delete _metadataHashes[tokenId];
        delete _encryptedURIs[tokenId];
    }
    
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    function _baseURI() internal pure override returns (string memory) {
        return "https://indexer-storage-testnet-turbo.0g.ai/";
    }
}