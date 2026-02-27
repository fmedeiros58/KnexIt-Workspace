/** @type {import('next').NextConfig} */
const distDir = process.env.NEXT_DIST_DIR?.trim();

const nextConfig = {
  ...(distDir ? { distDir } : {}),
  experimental: {
    serverActions: {
      allowedOrigins: ['*']
    }
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.knexspace.com" }],
        destination: "https://knexspace.com/:path*",
        permanent: true,
      },
    ];
  },
}
export default nextConfig
