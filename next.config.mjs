/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mammoth', 'word-extractor', 'xlsx', 'pdf-parse', 'pdfjs-dist', '@napi-rs/canvas'],
};

export default nextConfig;
