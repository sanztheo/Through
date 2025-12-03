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

      // Fix Node.js globals not defined in browser/Electron renderer
      config.resolve.fallback = {
        ...config.resolve.fallback,
        global: false,
        __dirname: false,
        __filename: false,
      };

      config.plugins.push(
        new (require('webpack')).DefinePlugin({
          'global': 'window',
          '__dirname': '"/"',
          '__filename': '""',
        })
      );
    }
    return config;
  }
};

module.exports = nextConfig;
