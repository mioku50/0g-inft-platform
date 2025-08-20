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

    // 2) На всякий случай — предпочесть 'main' над 'module'
    config.resolve.mainFields = ['main', 'module']

    // Обработка node: префиксов - simplified
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      worker_threads: false,
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
    serverComponentsExternalPackages: [
      '@0glabs/0g-ts-sdk',
      'ethers',
      '@walletconnect/core',
      '@walletconnect/sign-client',
      '@walletconnect/universal-provider',
      '@walletconnect/ethereum-provider',
      'unstorage',
      'pino',
      'thread-stream',
      // НЕ пишем '@0glabs/0g-serving-broker' здесь
    ],
    // Disable problematic features that might cause node: URI issues
    esmExternals: false,
  },
}

module.exports = nextConfig
