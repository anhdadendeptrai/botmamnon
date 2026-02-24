/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mammoth', 'word-extractor', 'xlsx', 'pdf-parse'],
};

export default nextConfig;
