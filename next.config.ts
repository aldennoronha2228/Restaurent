import type { NextConfig } from 'next';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebpackObfuscator = require('webpack-obfuscator');

const nextConfig: NextConfig = {
  reactStrictMode: false,
  turbopack: {},
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.plugins.push(
        new WebpackObfuscator(
          {
            compact: true,
            controlFlowFlattening: true,
            deadCodeInjection: true,
            stringArray: true,
            stringArrayEncoding: ['base64'],
            renameGlobals: false,
            identifierNamesGenerator: 'hexadecimal',
            splitStrings: true,
            splitStringsChunkLength: 8,
          },
          [
            '**/node_modules/**',
            '**/*.map',
            '**/framework-*.js',
            '**/main-*.js',
            '**/polyfills-*.js',
            '**/webpack-*.js',
          ]
        )
      );
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/admin',
        destination: '/super-admin',
      },
      {
        source: '/admin/:path*',
        destination: '/super-admin/:path*',
      },
    ];
  },
};

export default nextConfig;
