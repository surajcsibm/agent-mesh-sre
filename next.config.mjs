/** @type {import('next').NextConfig} */
const nextConfig = {
  // These packages contain Node.js native APIs and must not be bundled by
  // webpack. Next.js will require() them at runtime from node_modules instead.
  serverExternalPackages: [
    "@kubernetes/client-node",
    "kafkajs",
    "yaml",
  ],

  webpack(config, { isServer }) {
    if (!isServer) {
      // These are server-only packages — replace with empty stubs on the
      // client bundle so the browser build never tries to import them.
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
