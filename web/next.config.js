// next.config.js
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Нужен ТОЛЬКО брокер
  transpilePackages: ['@0glabs/0g-serving-broker'],

  webpack: (config, { isServer }) => {
    // Add conditionNames properly without overriding existing ones
    const names = new Set(config.resolve?.conditionNames ?? [])
    ;['import', 'module', 'browser', 'default'].forEach(n => names.add(n))
    if (isServer) names.add('node'); else names.delete('node')
    config.resolve = config.resolve || {}
    config.resolve.conditionNames = Array.from(names)
    // Минимальные fallbacks, чтобы не тянуть node-модули в браузер
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      child_process: false,
      'fs/promises': false,
      readline: false,
    }

    // Suppress dev warnings from pino-pretty and other unnecessary browser modules
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'pino-pretty': false,
      encoding: false,
      lokijs: false,
      // Fix Coinbase Wallet SDK build issues in Next/Webpack
      preact: require.resolve('preact'),
      'eventemitter3': require.resolve('eventemitter3/index.js'),
      // Map nested preact used by coinbase wallet to our preact
      '@coinbase/wallet-sdk/node_modules/preact': require.resolve('preact'),
      '@coinbase/wallet-sdk/node_modules/preact/compat': require.resolve('preact/compat'),
      '@coinbase/wallet-sdk/node_modules/preact/hooks': require.resolve('preact/hooks'),
      '@coinbase/wallet-sdk': require.resolve('./lib/shims/coinbase-wallet-sdk.js'),
      // WalletConnect legacy modal nested preact mapping
      '@walletconnect/legacy-modal/node_modules/preact': require.resolve('preact'),
      '@walletconnect/legacy-modal/node_modules/preact/compat': require.resolve('preact/compat'),
      '@walletconnect/legacy-modal/node_modules/preact/hooks': require.resolve('preact/hooks'),
      // Browser should not bundle ws
      ws: false,
      // Disable WalletConnect packages (not used)
      '@walletconnect/core': false,
      '@walletconnect/sign-client': false,
      '@walletconnect/universal-provider': false,
      '@walletconnect/ethereum-provider': false,
      '@walletconnect/legacy-client': false,
      '@walletconnect/legacy-provider': false,
      '@walletconnect/legacy-modal': false,
      '@walletconnect/randombytes': false,
      '@walletconnect/utils': false,
      ethers: require.resolve('./lib/shims/ethers'),
      // Handle SWC helpers that cause issues
      '@swc/helpers/_/_interop_require_default': false,
      '@swc/helpers/_/_interop_require_wildcard': false,
    }

    // Client-side only: Add definitions for SDK compatibility
    if (!isServer) {
      // Add webpack DefinePlugin to handle SDK requirements
      config.plugins = config.plugins || []
      const webpack = require('webpack')
      config.plugins.push(
        new webpack.DefinePlugin({
          'typeof require': '"undefined"',
          'global.require': 'undefined'
        }),
        // Add ProvidePlugin to provide globals that SDK might expect
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        })
      )
      
      // Ensure proper fallbacks for core modules and SWC helpers
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve('buffer'),
        process: require.resolve('process/browser'),
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        util: require.resolve('util'),
        events: require.resolve('events'),
        path: require.resolve('path-browserify'),
        os: require.resolve('os-browserify'),
        // Add SWC helpers fallbacks
        '@swc/helpers/_/_interop_require_default': false,
        '@swc/helpers/_/_interop_require_wildcard': false,
      }
    }

    return config
  },

  images: { domains: ['api.dicebear.com', 'ipfs.io'] },

  // ВАЖНО: убрать broker из serverComponentsExternalPackages — он не нужен на сервере
  experimental: {
    serverComponentsExternalPackages: [],
  },
}

module.exports = nextConfig
