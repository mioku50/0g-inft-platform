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

    if (!isServer) {
      // В браузерном бандле заглушаем Node-специфичные модули
      config.resolve.alias['pino-pretty'] = false
      config.resolve.alias['pino-std-serializers'] = false
      config.resolve.alias['sonic-boom'] = false
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

      config.externals = config.externals || []
      config.externals.push({
        'unstorage/drivers/fs-lite.cjs': 'commonjs unstorage/drivers/fs-lite.cjs',
        'pino-pretty': 'commonjs pino-pretty',
        'pino-std-serializers': 'commonjs pino-std-serializers',
        'sonic-boom': 'commonjs sonic-boom',
      })

      config.plugins = config.plugins || []
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, resource => {
          resource.request = resource.request.replace(/^node:/, '')
        })
      )
      config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /(pino-pretty|pino-std-serializers|sonic-boom)/ }))
    }

    return config
  },
};
module.exports = nextConfig
