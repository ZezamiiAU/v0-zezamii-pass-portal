/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Prevent @supabase/ssr from being bundled in client code
      config.resolve.alias = {
        ...config.resolve.alias,
        "@supabase/ssr": false,
      }
    }
    return config
  },
}

export default nextConfig
