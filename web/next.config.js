// next.config.js
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Нужен ТОЛЬКО брокер
  transpilePackages: [[ '@0glabs', '0g-serving-broker' ].join('/')],

  webpack: (config, { isServer }) => {
    // Никаких принудительных conditionNames — пусть Next сам выберет ESM для browser
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
      
      // Ensure proper fallbacks for core modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve('buffer'),
        process: require.resolve('process/browser'),
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        util: require.resolve('util'),
        path: require.resolve('path-browserify'),
        os: require.resolve('os-browserify'),
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
