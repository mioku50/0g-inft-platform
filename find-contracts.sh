#!/bin/bash

echo "=== Searching for contract addresses in 0G repositories ==="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Search in 0g-serving-contract
echo -e "\n${YELLOW}Checking 0g-serving-contract...${NC}"
cd /root/0g-inft-platform/temp/0g-serving-contract

# Look for deployment files
if [ -d "deployments" ]; then
    echo -e "${GREEN}Found deployments folder:${NC}"
    find deployments -name "*.json" -exec echo {} \; -exec grep -E '"address":|"contractAddress":' {} \; 2>/dev/null
fi

# Check for network-specific deployments
for network in "16601" "galileo" "testnet" "mainnet"; do
    files=$(find . -path "*${network}*" -name "*.json" 2>/dev/null | grep -v node_modules)
    if [ ! -z "$files" ]; then
        echo -e "\n${GREEN}Found files for network ${network}:${NC}"
        echo "$files"
    fi
done

# Search in token-counter if exists
if [ -d "/root/0g-inft-platform/temp/0g-serving-token-counter" ]; then
    echo -e "\n${YELLOW}Checking 0g-serving-token-counter...${NC}"
    cd /root/0g-inft-platform/temp/0g-serving-token-counter
    
    # Look for contract addresses
    grep -r "LedgerManager\|InferenceServing\|FineTuningServing" . --include="*.ts" --include="*.js" --include="*.json" 2>/dev/null | grep -E "address|0x[a-fA-F0-9]{40}"
fi

echo -e "\n${YELLOW}Done searching.${NC}"
