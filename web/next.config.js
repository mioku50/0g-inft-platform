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
    // 1) Принудительно даём CJS-вход вместо lib.esm для broker
    config.resolve.alias = config.resolve.alias || {}
    // Force CJS resolution by using main field
    config.resolve.alias['@0glabs/0g-serving-broker'] = require.resolve('@0glabs/0g-serving-broker')
    
    // Additionally, force the specific ESM entry to redirect to CJS
    config.resolve.alias['@0glabs/0g-serving-broker/lib.esm/index.mjs'] = require.resolve('@0glabs/0g-serving-broker')

    // 2) На всякий случай — предпочесть 'main' над 'module'
    config.resolve.mainFields = ['main', 'module']

    // Обработка node: префиксов
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      worker_threads: false,
      path: isServer ? false : require.resolve('path-browserify'),
      os: isServer ? false : require.resolve('os-browserify/browser'),
      url: isServer ? false : require.resolve('url/'),
      querystring: isServer ? false : require.resolve('querystring-es3'),
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
    config.resolve.alias = {
      ...config.resolve.alias,
      'node:crypto': 'crypto-browserify',
      'node:stream': 'stream-browserify',
      'node:buffer': 'buffer',
      'node:util': 'util',
      'node:events': 'events',
      'node:path': isServer ? 'path' : require.resolve('path-browserify'),
      'node:fs': false,
      'node:child_process': false,
      'node:fs/promises': false,
      'node:readline': false,
      'node:worker_threads': false,
      'node:os': isServer ? 'os' : require.resolve('os-browserify/browser'),
      'node:url': isServer ? 'url' : require.resolve('url/'),
      'node:querystring': isServer ? 'querystring' : require.resolve('querystring-es3'),
    }

    // Игнорируем некоторые модули
    config.externals.push({
      'pino-pretty': 'commonjs pino-pretty',
      lokijs: 'commonjs lokijs',
      encoding: 'commonjs encoding',
      'worker_threads': 'commonjs worker_threads',
      'thread-stream': 'commonjs thread-stream',
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
    serverComponentsExternalPackages: [
      '@0glabs/0g-ts-sdk',
      'ethers',
      'pino',
      'thread-stream',
      '@walletconnect/core',
      '@walletconnect/sign-client',
      // НЕ пишем '@0glabs/0g-serving-broker' здесь
    ],
  },
}

module.exports = nextConfig
