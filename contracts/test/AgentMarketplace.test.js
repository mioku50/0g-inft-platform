const { expect } = require(“chai”);
const { ethers } = require(“hardhat”);

describe(“AgentMarketplace Contract”, function () {
let inft;
let oracle;
let marketplace;
let owner;
let seller;
let buyer;

beforeEach(async function () {
[owner, seller, buyer] = await ethers.getSigners();

```
// Deploy contracts
const MockOracle = await ethers.getContractFactory("MockOracle");
oracle = await MockOracle.deploy();

const INFT = await ethers.getContractFactory("INFT");
inft = await INFT.deploy("0G AI Agents", "0GAINFT", oracle.address);

const AgentMarketplace = await ethers.getContractFactory("AgentMarketplace");
marketplace = await AgentMarketplace.deploy(inft.address, oracle.address);

// Mint a token for testing
const encryptedURI = "0g://storage/test123";
const metadataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test metadata"));
const mintPrice = await inft.mintPrice();

await inft.connect(seller).mint(seller.address, encryptedURI, metadataHash, { value: mintPrice });
```

});

describe(“Listing”, function () {
it(“Should list an agent for sale”, async function () {
const tokenId = 1;
const listingPrice = ethers.utils.parseEther(“0.1”);

```
  // Approve marketplace
  await inft.connect(seller).approve(marketplace.address, tokenId);

  await expect(
    marketplace.connect(seller).listAgent(tokenId, listingPrice)
  )
    .to.emit(marketplace, "AgentListed")
    .withArgs(tokenId, seller.address, listingPrice);

  const listing = await marketplace.getListing(tokenId);
  expect(listing.seller).to.equal(seller.address);
  expect(listing.price).to.equal(listingPrice);
  expect(listing.isActive).to.be.true;
});

it("Should update listing price", async function () {
  const tokenId = 1;
  const initialPrice = ethers.utils.parseEther("0.1");
  const newPrice = ethers.utils.parseEther("0.15");

  await inft.connect(seller).approve(marketplace.address, tokenId);
  await marketplace.connect(seller).listAgent(tokenId, initialPrice);

  await expect(
    marketplace.connect(seller).updateListing(tokenId, newPrice)
  )
    .to.emit(marketplace, "ListingUpdated")
    .withArgs(tokenId, newPrice);

  const listing = await marketplace.getListing(tokenId);
  expect(listing.price).to.equal(newPrice);
});

it("Should cancel listing", async function () {
  const tokenId = 1;
  const listingPrice = ethers.utils.parseEther("0.1");

  await inft.connect(seller).approve(marketplace.address, tokenId);
  await marketplace.connect(seller).listAgent(tokenId, listingPrice);

  await expect(
    marketplace.connect(seller).cancelListing(tokenId)
  )
    .to.emit(marketplace, "ListingCancelled")
    .withArgs(tokenId, seller.address);

  const listing = await marketplace.getListing(tokenId);
  expect(listing.isActive).to.be.false;
});
```

});

describe(“Purchasing”, function () {
beforeEach(async function () {
const tokenId = 1;
const listingPrice = ethers.utils.parseEther(“0.1”);

```
  await inft.connect(seller).approve(marketplace.address, tokenId);
  await marketplace.connect(seller).listAgent(tokenId, listingPrice);
});

it("Should purchase an agent", async function () {
  const tokenId = 1;
  const listing = await marketplace.getListing(tokenId);
  const buyerPublicKey = ethers.utils.hexlify(ethers.utils.randomBytes(32));

  await expect(
    marketplace.connect(buyer).purchaseAgent(tokenId, buyerPublicKey, { value: listing.price })
  )
    .to.emit(marketplace, "AgentSold")
    .withArgs(tokenId, seller.address, buyer.address, listing.price);

  // Check ownership transferred
  expect(await inft.ownerOf(tokenId)).to.equal(buyer.address);

  // Check listing removed
  const updatedListing = await marketplace.getListing(tokenId);
  expect(updatedListing.isActive).to.be.false;
});

it("Should handle marketplace fee correctly", async function () {
  const tokenId = 1;
  const listing = await marketplace.getListing(tokenId);
  const buyerPublicKey = ethers.utils.hexlify(ethers.utils.randomBytes(32));
  
  const fee = listing.price.mul(250).div(10000); // 2.5%
  const sellerProceeds = listing.price.sub(fee);

  await marketplace.connect(buyer).purchaseAgent(tokenId, buyerPublicKey, { value: listing.price });

  // Check pending withdrawals
  expect(await marketplace.pendingWithdrawals(seller.address)).to.equal(sellerProceeds);
  expect(await marketplace.pendingWithdrawals(owner.address)).to.equal(fee);
});

it("Should refund excess payment", async function () {
  const tokenId = 1;
  const listing = await marketplace.getListing(tokenId);
  const excessPayment = listing.price.add(ethers.utils.parseEther("0.05"));
  const buyerPublicKey = ethers.utils.hexlify(ethers.utils.randomBytes(32));

  const initialBalance = await buyer.getBalance();
  
  const tx = await marketplace.connect(buyer).purchaseAgent(
    tokenId, 
    buyerPublicKey, 
    { value: excessPayment }
  );
  
  const receipt = await tx.wait();
  const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
  const finalBalance = await buyer.getBalance();
  
  // Check that only listing price was deducted (plus gas)
  expect(initialBalance.sub(finalBalance).sub(gasUsed)).to.equal(listing.price);
});
```

});

describe(“Withdrawals”, function () {
it(“Should withdraw pending funds”, async function () {
const tokenId = 1;
const listingPrice = ethers.utils.parseEther(“0.1”);
const buyerPublicKey = ethers.utils.hexlify(ethers.utils.randomBytes(32));

```
  await inft.connect(seller).approve(marketplace.address, tokenId);
  await marketplace.connect(seller).listAgent(tokenId, listingPrice);
  await marketplace.connect(buyer).purchaseAgent(tokenId, buyerPublicKey, { value: listingPrice });

  const pendingAmount = await marketplace.pendingWithdrawals(seller.address);
  const initialBalance = await seller.getBalance();
  
  const tx = await marketplace.connect(seller).withdraw();
  const receipt = await tx.wait();
  const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
  const finalBalance = await seller.getBalance();
  
  expect(finalBalance.sub(initialBalance).add(gasUsed)).to.equal(pendingAmount);
  expect(await marketplace.pendingWithdrawals(seller.address)).to.equal(0);
});
```

});
});