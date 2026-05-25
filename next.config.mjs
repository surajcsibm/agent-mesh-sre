/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Next.js 14.x uses this key (renamed to serverExternalPackages in 15+)
    serverComponentsExternalPackages: [
      "@kubernetes/client-node",
      "kafkajs",
      "yaml",
    ],
  },

  webpack(config, { isServer }) {
    if (!isServer) {
      // Server-only packages — replace with empty stubs on the client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "@kubernetes/client-node": false,
        "kafkajs": false,
        "yaml": false,
      };
    }
    return config;
  },
};

export default nextConfig;
