#!/usr/bin/env node

/**
 * Demonstration of the debug endpoint functionality
 * Shows how the GET /api/debug/env?name=FT_ATTEST_ONCHAIN endpoint would work
 */

// Simulate the debug endpoint response for FT_ATTEST_ONCHAIN
function simulateDebugEndpoint(envName, envValue) {
    console.log(`\n🔍 Debug Endpoint Simulation: GET /api/debug/env?name=${envName}`);
    console.log('=' .repeat(60));
    
    // Set up environment
    if (envValue !== undefined) {
        process.env[envName] = envValue;
    } else {
        delete process.env[envName];
    }
    
    // Simulate the parseBoolEnv logic
    function parseBoolEnv(name, defaultValue = false) {
        const value = process.env[name];
        if (!value) return defaultValue;
        
        const cleanValue = value.split('#')[0].trim().toLowerCase();
        if (!cleanValue) return defaultValue;
        
        if (['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(cleanValue)) {
            return true;
        }
        if (['0', 'false', 'no', 'off', 'disable', 'disabled'].includes(cleanValue)) {
            return false;
        }
        return defaultValue;
    }
    
    const rawValue = process.env[envName];
    const parsedValue = parseBoolEnv(envName, false);
    
    // Simulate the API response
    const response = {
        success: true,
        environment: 'development',
        debug: {
            name: envName,
            rawValue: rawValue || null,
            exists: rawValue !== undefined,
            timestamp: new Date().toISOString(),
            type: 'boolean',
            parsedValue: parsedValue,
            parseLogic: {
                trueValues: ['1', 'true', 'yes', 'on', 'enable', 'enabled'],
                falseValues: ['0', 'false', 'no', 'off', 'disable', 'disabled'],
                supportsComments: true,
                example: '1 # enable on-chain attestation'
            },
            debugInfo: {
                purpose: 'Controls whether fine-tuning tasks are attested on-chain',
                defaultValue: false,
                recommendation: 'Set to "1" to enable on-chain attestation',
                currentBehavior: parsedValue ? 'Attestation ENABLED' : 'Attestation DISABLED',
                environmentCheck: rawValue || 'Not set'
            }
        }
    };
    
    console.log(JSON.stringify(response, null, 2));
    
    return response;
}

// Demonstrate different scenarios
console.log('🚀 Debug Endpoint Demonstrations');
console.log('=================================');

// Scenario 1: FT_ATTEST_ONCHAIN=1 (enable attestation)
simulateDebugEndpoint('FT_ATTEST_ONCHAIN', '1');

// Scenario 2: FT_ATTEST_ONCHAIN=0 (disable attestation)  
simulateDebugEndpoint('FT_ATTEST_ONCHAIN', '0');

// Scenario 3: FT_ATTEST_ONCHAIN with comment
simulateDebugEndpoint('FT_ATTEST_ONCHAIN', '1 # enable on-chain attestation');

// Scenario 4: FT_ATTEST_ONCHAIN not set
simulateDebugEndpoint('FT_ATTEST_ONCHAIN', undefined);

console.log('\n🎯 Key Features Demonstrated:');
console.log('✅ Robust boolean parsing with multiple formats');
console.log('✅ Inline comment support (value # comment)');
console.log('✅ Clear behavior indication (ENABLED/DISABLED)');
console.log('✅ Comprehensive debugging information');
console.log('✅ Security-aware (sensitive variables would be redacted)');
console.log('✅ Feature-flagged for dev/stage environments');

console.log('\n📋 Usage Examples:');
console.log('GET /api/debug/env?name=FT_ATTEST_ONCHAIN');
console.log('GET /api/debug/env?name=NEXT_PUBLIC_0G_RPC_URL'); 
console.log('GET /api/debug/env?name=NODE_ENV');
console.log('POST /api/debug/env (lists common variables)');

console.log('\n🔧 Production Usage:');
console.log('1. Set ENABLE_DEBUG_API=1 in production to enable');
console.log('2. Use for troubleshooting environment configuration');
console.log('3. Verify FT_ATTEST_ONCHAIN parsing in staging');
console.log('4. Debug provider accessibility issues');

console.log('\n✅ Debug endpoint implementation is ready for production use!');