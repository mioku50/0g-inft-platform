// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import “@openzeppelin/contracts/token/ERC721/ERC721.sol”;
import “@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol”;
import “@openzeppelin/contracts/access/Ownable.sol”;
import “@openzeppelin/contracts/security/ReentrancyGuard.sol”;
import “@openzeppelin/contracts/utils/Counters.sol”;

interface IOracle {
function verifyProof(bytes calldata proof) external view returns (bool);
function processTransfer(
uint256 tokenId,
address from,
address to,
bytes calldata encryptedData
) external returns (bytes memory newSealedKey, bytes memory proof);
}

/**

- @title INFT - Intelligent NFT Contract
- @notice NFTs with encrypted AI agent metadata stored on 0G Storage
  */
  contract INFT is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
  using Counters for Counters.Counter;
  
  // State variables
  Counters.Counter private _tokenIdCounter;
  mapping(uint256 => bytes32) private _metadataHashes;
  mapping(uint256 => string) private _encryptedURIs;
  mapping(uint256 => mapping(address => bytes)) private _authorizations;
  mapping(uint256 => address[]) private _authorizedUsers;
  
  address public oracle;
  uint256 public mintPrice = 0.01 ether; // Price in A0GI
  
  // Events
  event AgentMinted(uint256 indexed tokenId, address indexed owner, string encryptedURI);
  event MetadataUpdated(uint256 indexed tokenId, bytes32 newHash);
  event UsageAuthorized(uint256 indexed tokenId, address indexed executor, bytes permissions);
  event UsageRevoked(uint256 indexed tokenId, address indexed executor);
  event TransferCompleted(uint256 indexed tokenId, address indexed from, address indexed to);
  
  constructor(
  string memory name,
  string memory symbol,
  address _oracle
  ) ERC721(name, symbol) {
  oracle = _oracle;
  }
  
  /**
  - @notice Mint a new AI agent NFT
  - @param to The recipient address
  - @param encryptedURI The encrypted URI pointing to agent data on 0G Storage
  - @param metadataHash Hash of the unencrypted metadata for verification
    */
    function mint(
    address to,
    string calldata encryptedURI,
    bytes32 metadataHash
    ) external payable nonReentrant returns (uint256) {
    require(msg.value >= mintPrice, “Insufficient payment”);
    
    _tokenIdCounter.increment();
    uint256 tokenId = _tokenIdCounter.current();
    
    _safeMint(to, tokenId);
    _setTokenURI(tokenId, encryptedURI);
    
    _encryptedURIs[tokenId] = encryptedURI;
    _metadataHashes[tokenId] = metadataHash;
    
    emit AgentMinted(tokenId, to, encryptedURI);
    
    // Refund excess payment
    if (msg.value > mintPrice) {
    payable(msg.sender).transfer(msg.value - mintPrice);
    }
    
    return tokenId;
    }
  
  /**
  - @notice Transfer with automatic re-encryption
  - @param from Current owner
  - @param to New owner
  - @param tokenId Token to transfer
  - @param sealedKey New sealed encryption key for recipient
  - @param proof Oracle proof of valid re-encryption
    */
    function secureTransfer(
    address from,
    address to,
    uint256 tokenId,
    bytes calldata sealedKey,
    bytes calldata proof
    ) external nonReentrant {
    require(_isApprovedOrOwner(msg.sender, tokenId), “Not authorized”);
    require(ownerOf(tokenId) == from, “Invalid owner”);
    require(IOracle(oracle).verifyProof(proof), “Invalid proof”);
    
    // Revoke all existing authorizations
    _revokeAllAuthorizations(tokenId);
    
    // Update metadata access for new owner
    _updateMetadataAccess(tokenId, to, sealedKey, proof);
    
    // Transfer token ownership
    _transfer(from, to, tokenId);
    
    emit TransferCompleted(tokenId, from, to);
    }
  
  /**
  - @notice Authorize usage without transferring ownership
  - @param tokenId The token to authorize
  - @param executor Address to authorize
  - @param permissions Encoded permissions data
    */
    function authorizeUsage(
    uint256 tokenId,
    address executor,
    bytes calldata permissions
    ) external {
    require(ownerOf(tokenId) == msg.sender, “Not owner”);
    require(executor != address(0), “Invalid executor”);
    
    _authorizations[tokenId][executor] = permissions;
    
    // Track authorized users
    if (!_isAuthorized(tokenId, executor)) {
    _authorizedUsers[tokenId].push(executor);
    }
    
    emit UsageAuthorized(tokenId, executor, permissions);
    }
  
  /**
  - @notice Revoke usage authorization
  - @param tokenId The token ID
  - @param executor Address to revoke
    */
    function revokeUsage(uint256 tokenId, address executor) external {
    require(ownerOf(tokenId) == msg.sender, “Not owner”);
    
    delete _authorizations[tokenId][executor];
    emit UsageRevoked(tokenId, executor);
    }
  
  /**
  - @notice Get authorization data
  - @param tokenId The token ID
  - @param executor The executor address
    */
    function getAuthorization(
    uint256 tokenId,
    address executor
    ) external view returns (bytes memory) {
    return _authorizations[tokenId][executor];
    }
  
  /**
  - @notice Get all authorized users for a token
  - @param tokenId The token ID
    */
    function getAuthorizedUsers(uint256 tokenId) external view returns (address[] memory) {
    return _authorizedUsers[tokenId];
    }
  
  /**
  - @notice Get metadata hash
  - @param tokenId The token ID
    */
    function getMetadataHash(uint256 tokenId) external view returns (bytes32) {
    require(_exists(tokenId), “Token does not exist”);
    return _metadataHashes[tokenId];
    }
  
  /**
  - @notice Get encrypted URI
  - @param tokenId The token ID
    */
    function getEncryptedURI(uint256 tokenId) external view returns (string memory) {
    require(_exists(tokenId), “Token does not exist”);
    return _encryptedURIs[tokenId];
    }
  
  /**
  - @notice Update mint price (owner only)
  - @param newPrice New price in wei
    */
    function setMintPrice(uint256 newPrice) external onlyOwner {
    mintPrice = newPrice;
    }
  
  /**
  - @notice Update oracle address (owner only)
  - @param newOracle New oracle address
    */
    function setOracle(address newOracle) external onlyOwner {
    require(newOracle != address(0), “Invalid oracle”);
    oracle = newOracle;
    }
  
  /**
  - @notice Withdraw contract balance (owner only)
    */
    function withdraw() external onlyOwner {
    uint256 balance = address(this).balance;
    require(balance > 0, “No balance”);
    payable(owner()).transfer(balance);
    }
  
  // Internal functions
  function _updateMetadataAccess(
  uint256 tokenId,
  address newOwner,
  bytes calldata sealedKey,
  bytes calldata proof
  ) internal {
  // Extract new metadata hash from proof (first 32 bytes)
  bytes32 newHash = bytes32(proof[0:32]);
  _metadataHashes[tokenId] = newHash;
  
  ```
   // Update encrypted URI if provided in proof (after first 64 bytes)
   if (proof.length > 64) {
       string memory newURI = string(proof[64:]);
       _encryptedURIs[tokenId] = newURI;
       _setTokenURI(tokenId, newURI);
   }
   
   emit MetadataUpdated(tokenId, newHash);
  ```
  
  }
  
  function _revokeAllAuthorizations(uint256 tokenId) internal {
  address[] memory users = _authorizedUsers[tokenId];
  for (uint i = 0; i < users.length; i++) {
  delete _authorizations[tokenId][users[i]];
  emit UsageRevoked(tokenId, users[i]);
  }
  delete _authorizedUsers[tokenId];
  }
  
  function _isAuthorized(uint256 tokenId, address user) internal view returns (bool) {
  address[] memory users = _authorizedUsers[tokenId];
  for (uint i = 0; i < users.length; i++) {
  if (users[i] == user) return true;
  }
  return false;
  }
  
  function _exists(uint256 tokenId) internal view returns (bool) {
  return _ownerOf(tokenId) != address(0);
  }
  
  // Required overrides
  function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
  super._burn(tokenId);
  delete _metadataHashes[tokenId];
  delete _encryptedURIs[tokenId];
  _revokeAllAuthorizations(tokenId);
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
  override(ERC721, ERC721URIStorage)
  returns (bool)
  {
  return super.supportsInterface(interfaceId);
  }
  }

app/mint/page.tsx - 👇 

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import “@openzeppelin/contracts/token/ERC721/ERC721.sol”;
import “@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol”;
import “@openzeppelin/contracts/access/Ownable.sol”;
import “@openzeppelin/contracts/security/ReentrancyGuard.sol”;
import “@openzeppelin/contracts/utils/Counters.sol”;

interface IOracle {
function verifyProof(bytes calldata proof) external view returns (bool);
function processTransfer(
uint256 tokenId,
address from,
address to,
bytes calldata encryptedData
) external returns (bytes memory newSealedKey, bytes memory proof);
}

/**

- @title INFT - Intelligent NFT Contract
- @notice NFTs with encrypted AI agent metadata stored on 0G Storage
  */
  contract INFT is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
  using Counters for Counters.Counter;
  
  // State variables
  Counters.Counter private _tokenIdCounter;
  mapping(uint256 => bytes32) private _metadataHashes;
  mapping(uint256 => string) private _encryptedURIs;
  mapping(uint256 => mapping(address => bytes)) private _authorizations;
  mapping(uint256 => address[]) private _authorizedUsers;
  
  address public oracle;
  uint256 public mintPrice = 0.01 ether; // Price in A0GI
  
  // Events
  event AgentMinted(uint256 indexed tokenId, address indexed owner, string encryptedURI);
  event MetadataUpdated(uint256 indexed tokenId, bytes32 newHash);
  event UsageAuthorized(uint256 indexed tokenId, address indexed executor, bytes permissions);
  event UsageRevoked(uint256 indexed tokenId, address indexed executor);
  event TransferCompleted(uint256 indexed tokenId, address indexed from, address indexed to);
  
  constructor(
  string memory name,
  string memory symbol,
  address _oracle
  ) ERC721(name, symbol) {
  oracle = _oracle;
  }
  
  /**
  - @notice Mint a new AI agent NFT
  - @param to The recipient address
  - @param encryptedURI The encrypted URI pointing to agent data on 0G Storage
  - @param metadataHash Hash of the unencrypted metadata for verification
    */
    function mint(
    address to,
    string calldata encryptedURI,
    bytes32 metadataHash
    ) external payable nonReentrant returns (uint256) {
    require(msg.value >= mintPrice, “Insufficient payment”);
    
    _tokenIdCounter.increment();
    uint256 tokenId = _tokenIdCounter.current();
    
    _safeMint(to, tokenId);
    _setTokenURI(tokenId, encryptedURI);
    
    _encryptedURIs[tokenId] = encryptedURI;
    _metadataHashes[tokenId] = metadataHash;
    
    emit AgentMinted(tokenId, to, encryptedURI);
    
    // Refund excess payment
    if (msg.value > mintPrice) {
    payable(msg.sender).transfer(msg.value - mintPrice);
    }
    
    return tokenId;
    }
  
  /**
  - @notice Transfer with automatic re-encryption
  - @param from Current owner
  - @param to New owner
  - @param tokenId Token to transfer
  - @param sealedKey New sealed encryption key for recipient
  - @param proof Oracle proof of valid re-encryption
    */
    function secureTransfer(
    address from,
    address to,
    uint256 tokenId,
    bytes calldata sealedKey,
    bytes calldata proof
    ) external nonReentrant {
    require(_isApprovedOrOwner(msg.sender, tokenId), “Not authorized”);
    require(ownerOf(tokenId) == from, “Invalid owner”);
    require(IOracle(oracle).verifyProof(proof), “Invalid proof”);
    
    // Revoke all existing authorizations
    _revokeAllAuthorizations(tokenId);
    
    // Update metadata access for new owner
    _updateMetadataAccess(tokenId, to, sealedKey, proof);
    
    // Transfer token ownership
    _transfer(from, to, tokenId);
    
    emit TransferCompleted(tokenId, from, to);
    }
  
  /**
  - @notice Authorize usage without transferring ownership
  - @param tokenId The token to authorize
  - @param executor Address to authorize
  - @param permissions Encoded permissions data
    */
    function authorizeUsage(
    uint256 tokenId,
    address executor,
    bytes calldata permissions
    ) external {
    require(ownerOf(tokenId) == msg.sender, “Not owner”);
    require(executor != address(0), “Invalid executor”);
    
    _authorizations[tokenId][executor] = permissions;
    
    // Track authorized users
    if (!_isAuthorized(tokenId, executor)) {
    _authorizedUsers[tokenId].push(executor);
    }
    
    emit UsageAuthorized(tokenId, executor, permissions);
    }
  
  /**
  - @notice Revoke usage authorization
  - @param tokenId The token ID
  - @param executor Address to revoke
    */
    function revokeUsage(uint256 tokenId, address executor) external {
    require(ownerOf(tokenId) == msg.sender, “Not owner”);
    
    delete _authorizations[tokenId][executor];
    emit UsageRevoked(tokenId, executor);
    }
  
  /**
  - @notice Get authorization data
  - @param tokenId The token ID
  - @param executor The executor address
    */
    function getAuthorization(
    uint256 tokenId,
    address executor
    ) external view returns (bytes memory) {
    return _authorizations[tokenId][executor];
    }
  
  /**
  - @notice Get all authorized users for a token
  - @param tokenId The token ID
    */
    function getAuthorizedUsers(uint256 tokenId) external view returns (address[] memory) {
    return _authorizedUsers[tokenId];
    }
  
  /**
  - @notice Get metadata hash
  - @param tokenId The token ID
    */
    function getMetadataHash(uint256 tokenId) external view returns (bytes32) {
    require(_exists(tokenId), “Token does not exist”);
    return _metadataHashes[tokenId];
    }
  
  /**
  - @notice Get encrypted URI
  - @param tokenId The token ID
    */
    function getEncryptedURI(uint256 tokenId) external view returns (string memory) {
    require(_exists(tokenId), “Token does not exist”);
    return _encryptedURIs[tokenId];
    }
  
  /**
  - @notice Update mint price (owner only)
  - @param newPrice New price in wei
    */
    function setMintPrice(uint256 newPrice) external onlyOwner {
    mintPrice = newPrice;
    }
  
  /**
  - @notice Update oracle address (owner only)
  - @param newOracle New oracle address
    */
    function setOracle(address newOracle) external onlyOwner {
    require(newOracle != address(0), “Invalid oracle”);
    oracle = newOracle;
    }
  
  /**
  - @notice Withdraw contract balance (owner only)
    */
    function withdraw() external onlyOwner {
    uint256 balance = address(this).balance;
    require(balance > 0, “No balance”);
    payable(owner()).transfer(balance);
    }
  
  // Internal functions
  function _updateMetadataAccess(
  uint256 tokenId,
  address newOwner,
  bytes calldata sealedKey,
  bytes calldata proof
  ) internal {
  // Extract new metadata hash from proof (first 32 bytes)
  bytes32 newHash = bytes32(proof[0:32]);
  _metadataHashes[tokenId] = newHash;
  
  ```
   // Update encrypted URI if provided in proof (after first 64 bytes)
   if (proof.length > 64) {
       string memory newURI = string(proof[64:]);
       _encryptedURIs[tokenId] = newURI;
       _setTokenURI(tokenId, newURI);
   }
   
   emit MetadataUpdated(tokenId, newHash);
  ```
  
  }
  
  function _revokeAllAuthorizations(uint256 tokenId) internal {
  address[] memory users = _authorizedUsers[tokenId];
  for (uint i = 0; i < users.length; i++) {
  delete _authorizations[tokenId][users[i]];
  emit UsageRevoked(tokenId, users[i]);
  }
  delete _authorizedUsers[tokenId];
  }
  
  function _isAuthorized(uint256 tokenId, address user) internal view returns (bool) {
  address[] memory users = _authorizedUsers[tokenId];
  for (uint i = 0; i < users.length; i++) {
  if (users[i] == user) return true;
  }
  return false;
  }
  
  function _exists(uint256 tokenId) internal view returns (bool) {
  return _ownerOf(tokenId) != address(0);
  }
  
  // Required overrides
  function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
  super._burn(tokenId);
  delete _metadataHashes[tokenId];
  delete _encryptedURIs[tokenId];
  _revokeAllAuthorizations(tokenId);
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
  override(ERC721, ERC721URIStorage)
  returns (bool)
  {
  return super.supportsInterface(interfaceId);
  }
  }