import type { NextConfig } from 'next';

const cloudflareStaticExport = process.env.CLOUDFLARE_STATIC_EXPORT === '1';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(cloudflareStaticExport
    ? {
        output: 'export',
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
