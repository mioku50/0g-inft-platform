// Загружаем переменные из .env файла
require('dotenv').config({ path: '.env' })

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
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['@0glabs/0g-serving-broker'] = 
      require.resolve('@0glabs/0g-serving-broker');
    config.resolve.mainFields = ['main', 'module'];

    if (!isServer) {
      // В браузерном бандле выключаем node:* и fs/crypto
      config.resolve.alias['node:fs'] = false;
      config.resolve.alias['node:path'] = false;
      config.resolve.alias['node:crypto'] = false;
      config.resolve.alias['node:util'] = false;
      config.resolve.alias['node:stream'] = false;
      config.resolve.alias['node:buffer'] = false;

      // На случай, если какой-то модуль потребует обычные имена
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        crypto: false,
        path: false,
        net: false,
        tls: false,
        stream: false,
        util: false,
        buffer: false,
        events: false,
        process: false,
        child_process: false,
        'fs/promises': false,
        readline: false,
        worker_threads: false,
        module: false,
      };

      // Доп. страховка: если unstorage вдруг схватит fs-драйвер
      config.resolve.alias['unstorage/drivers/fs-lite.cjs'] = false;
      config.resolve.alias['unstorage/drivers/fs-lite'] = false;
      config.resolve.alias['@walletconnect/keyvaluestorage/dist/index.cjs.js'] = false;
      
      // Отключаем проблемные модули, которые пытаются загрузить fs
      config.externals = config.externals || [];
      config.externals.push({
        'unstorage/drivers/fs-lite.cjs': 'commonjs unstorage/drivers/fs-lite.cjs',
        'pino-pretty': 'commonjs pino-pretty',
        lokijs: 'commonjs lokijs',
        encoding: 'commonjs encoding',
      });
    }

    return config;
  },
};

module.exports = nextConfig;

module.exports = nextConfig
