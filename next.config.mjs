/** @type {import('next').NextConfig} */
const nextConfig = {
  // These packages use Node.js native modules and must not be bundled by webpack.
  // Vercel will resolve them at runtime from node_modules.
  serverExternalPackages: [
    "@kubernetes/client-node",
    "kafkajs",
  ],
};

export default nextConfig;
