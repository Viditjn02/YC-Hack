//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');


/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  // Override PORT env so frontend doesn't conflict with game server
  devIndicators: false,
  // Static export for Cloudflare Pages
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  // Fix: Turbopack picks up a parent lockfile outside the monorepo.
  // Pin the root to the actual monorepo directory so module resolution
  // and module wrapping work correctly in dev mode.
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);

