// next.config.js
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Нужен ТОЛЬКО брокер
  transpilePackages: ['@0glabs/0g-serving-broker'],

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

    return config
  },

  images: { domains: ['api.dicebear.com', 'ipfs.io'] },

  // ВАЖНО: убрать broker из serverComponentsExternalPackages — он не нужен на сервере
  experimental: {
    serverComponentsExternalPackages: [],
  },
}

module.exports = nextConfig
