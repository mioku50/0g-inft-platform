// Загружаем переменные из .env файла
require('dotenv').config({ path: '.env' })
const path = require('path')
const webpack = require('webpack')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      '@0glabs/0g-ts-sdk',
      'ethers',
      // НЕ добавляем сюда '@0glabs/0g-serving-broker'
    ],
  },
  transpilePackages: [
    '@0glabs/0g-serving-broker',
  ],

  webpack: (config, { isServer }) => {
    // 0g-serving-broker — жёстко на CJS-вход
    config.resolve.alias = config.resolve.alias || {}
    const brokerEntry = require.resolve('@0glabs/0g-serving-broker')
    config.resolve.alias['@0glabs/0g-serving-broker'] = path.join(path.dirname(brokerEntry), '../lib.commonjs/index.js')
    config.resolve.mainFields = ['main', 'module']

    // В обоих бандлах настраиваем alias для pino и вырезаем опциональные зависимости
    const emptyModule = path.resolve(__dirname, 'temp/empty-module.js')
    // Критично: pino → браузерная сборка, чтобы отсечь зависимость от pino-std-serializers
    config.resolve.alias['pino'] = 'pino/browser'
    // Эти модули не нужны в браузере/у нас не используются — заглушаем
    config.resolve.alias['pino-pretty'] = emptyModule
    config.resolve.alias['pino-std-serializers'] = emptyModule
    config.resolve.alias['sonic-boom'] = emptyModule

    if (!isServer) {
      // В браузере дополнительно вырезаем Node-специфичные модули
      config.resolve.alias['node:fs'] = false
      config.resolve.alias['node:path'] = require.resolve('path-browserify')
      config.resolve.alias['node:crypto'] = false
      config.resolve.alias['unstorage/drivers/fs-lite.cjs'] = false
      config.resolve.alias['@walletconnect/keyvaluestorage/dist/index.cjs.js'] = false

      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        net: false,
        tls: false,
        stream: false,
        worker_threads: false,
        module: false,
        encoding: false,
        'pino-pretty': false,
        'pino-std-serializers': false,
        'sonic-boom': false,
      }

      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, resource => {
          resource.request = resource.request.replace(/^node:/, '')
        })
      )
    }

    return config
  },
};
module.exports = nextConfig
