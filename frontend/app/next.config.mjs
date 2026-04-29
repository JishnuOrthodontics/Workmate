/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost'],
  },
  env: {
    NEXT_PUBLIC_BACKEND_CONTEXT_PATH: process.env.NEXT_PUBLIC_BACKEND_CONTEXT_PATH || 'http://localhost:3000',
    NEXT_PUBLIC_USE_EDGE_AUTH: process.env.NEXT_PUBLIC_USE_EDGE_AUTH || 'false',
  },
}

export default nextConfig
