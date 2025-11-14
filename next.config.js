/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // força este diretório como root do projeto
    root: __dirname,
  },
};

module.exports = nextConfig;
