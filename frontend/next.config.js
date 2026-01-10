/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // For GitHub Pages: use static export
  // For Vercel: use standalone (set via environment variable)
  output: process.env.GITHUB_PAGES === 'true' ? 'export' : 'standalone',
  // Base path for GitHub Pages (if repository is not username.github.io)
  // Set GITHUB_PAGES_BASE_PATH environment variable if needed
  basePath: process.env.GITHUB_PAGES_BASE_PATH || '',
  // Trailing slash for GitHub Pages compatibility
  trailingSlash: process.env.GITHUB_PAGES === 'true',
  // Disable image optimization for static export
  images: {
    unoptimized: process.env.GITHUB_PAGES === 'true',
  },
  // API rewrites (proxy) so the frontend can call same-origin /api/*.
  // This helps cookies (refreshToken) work reliably in production.
  async rewrites() {
    // Rewrites don't work with static export (GitHub Pages)
    if (process.env.GITHUB_PAGES === 'true') {
      return [];
    }

    // Recommended setup:
    // - Frontend calls: NEXT_PUBLIC_API_URL=/api
    // - Proxy target (server-only): API_PROXY_TARGET=https://<backend>.vercel.app/api
    const target = process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL;
    if (!target) return [];

    // Avoid accidental rewrite loops if someone sets NEXT_PUBLIC_API_URL=/api
    if (!/^https?:\/\//.test(target)) return [];

    return [{ source: '/api/:path*', destination: `${target}/:path*` }];
  },
};

module.exports = nextConfig;

