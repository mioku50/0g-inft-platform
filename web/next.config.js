// Загружаем переменные из .env файла
require('dotenv').config({ path: '.env' })

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@0glabs/0g-serving-broker"],
  // Явно передаем переменные в среду выполнения
  env: {
    OG_STORAGE_PRIVATE_KEY: process.env.OG_STORAGE_PRIVATE_KEY || '',
    OG_COMPUTE_PRIVATE_KEY: process.env.OG_COMPUTE_PRIVATE_KEY || '',
  },
  webpack: (config, { isServer }) => {
    // Обработка node: префиксов
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: isServer ? false : require.resolve('crypto-browserify'),
      stream: isServer ? false : require.resolve('stream-browserify'),
      util: isServer ? false : require.resolve('util/'),
      buffer: isServer ? false : require.resolve('buffer/'),
      events: isServer ? false : require.resolve('events/'),
      process: isServer ? false : require.resolve('process/browser'),
      child_process: false,
      'fs/promises': false,
      readline: false,
    }

    // Предотвращаем обработку node: модулей в браузере
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'node:crypto': 'crypto-browserify',
        'node:stream': 'stream-browserify',
        'node:buffer': 'buffer',
        'node:util': 'util',
        'node:events': 'events',
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
  // Экспериментальная поддержка для серверных компонентов
  experimental: {
    serverComponentsExternalPackages: ['@0glabs/0g-ts-sdk', '@0glabs/0g-serving-broker', 'ethers'],
  },
}

module.exports = nextConfig
