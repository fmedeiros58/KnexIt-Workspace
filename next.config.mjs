/** @type {import('next').NextConfig} */
const nextConfig = {
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
