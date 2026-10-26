import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/sayform-landing.html',
        destination: '/home',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/home',
        destination: '/sayform-landing.html',
      },
    ];
  },
};

export default nextConfig;
