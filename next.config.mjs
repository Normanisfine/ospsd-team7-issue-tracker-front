/** @type {import('next').NextConfig} */

// When the GitHub Pages workflow runs it sets NEXT_PUBLIC_BASE_PATH=/<repo-name>
// so the built assets resolve under https://<user>.github.io/<repo-name>/.
// Locally (npm run dev) the variable is unset and the app stays at /.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
};

export default nextConfig;
