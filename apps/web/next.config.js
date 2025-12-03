/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true
  },
  trailingSlash: true,

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.target = 'electron-renderer';

      // Fix "global is not defined" error in Electron
      config.resolve.fallback = {
        ...config.resolve.fallback,
        global: false,
      };

      config.plugins.push(
        new (require('webpack')).DefinePlugin({
          'global': 'window',
        })
      );
    }
    return config;
  }
};

module.exports = nextConfig;
