// Загружаем переменные из .env файла
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@0glabs/0g-serving-broker"],
  // Явно передаем переменные в среду выполнения
  env: {
    OG_STORAGE_PRIVATE_KEY: process.env.OG_STORAGE_PRIVATE_KEY || '',
    OG_COMPUTE_PRIVATE_KEY: process.env.OG_COMPUTE_PRIVATE_KEY || '',
    USE_NONCUSTODIAL_INFERENCE: process.env.USE_NONCUSTODIAL_INFERENCE || 'false',
    ENABLE_FINE_TUNE: process.env.ENABLE_FINE_TUNE || 'false',
  },
  webpack: (config, { isServer }) => {
    // Add polyfills for Node.js modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: !isServer ? require.resolve('crypto-browserify') : false,
      stream: !isServer ? require.resolve('stream-browserify') : false,
      util: !isServer ? require.resolve('util/') : false,
      buffer: !isServer ? require.resolve('buffer/') : false,
      events: !isServer ? require.resolve('events/') : false,
      process: !isServer ? require.resolve('process/browser') : false,
      path: !isServer ? require.resolve('path-browserify') : false,
      os: !isServer ? require.resolve('os-browserify/browser') : false,
      child_process: false,
      'fs/promises': false,
      readline: false,
    }

    // Handle node: protocol imports for browser
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'node:crypto': 'crypto-browserify',
        'node:stream': 'stream-browserify',
        'node:buffer': 'buffer',
        'node:util': 'util',
        'node:events': 'events',
        'node:path': 'path-browserify',
        'node:os': 'os-browserify/browser',
        'node:process': 'process/browser',
        'node:fs': false,
        'node:child_process': false,
        'node:fs/promises': false,
        'node:readline': false,
      }
    }

    // Игнорируем некоторые модули
    config.externals.push({
      'pino-pretty': 'commonjs pino-pretty',
      lokijs: 'commonjs lokijs',
      encoding: 'commonjs encoding',
    })

    // Provide глобальные переменные
    const webpack = require('webpack')
    config.plugins.push(
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser',
      })
    )

    return config
  },
  images: {
    domains: ['api.dicebear.com', 'ipfs.io'],
  },
  // Remove esmExternals as it causes issues with SDK imports
  experimental: {
    serverComponentsExternalPackages: ['@0glabs/0g-ts-sdk', '@0glabs/0g-serving-broker', '@0glabs/0g-serving-user-broker'],
  },
}

module.exports = nextConfig
