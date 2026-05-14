/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "@xyflow/react"],
  },
};

export default nextConfig;
