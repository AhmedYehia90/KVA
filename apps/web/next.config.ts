import type {NextConfig} from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  async headers() {
    const revision = process.env.VERCEL_GIT_COMMIT_SHA;
    return [{source: "/:path*", headers: [
      ...(revision && /^[a-f0-9]{40}$/i.test(revision) ? [{key: "X-KVA-Revision", value: revision}] : []),
      {key: "X-Content-Type-Options", value: "nosniff"},
      {key: "X-Frame-Options", value: "DENY"},
      {key: "Referrer-Policy", value: "strict-origin-when-cross-origin"},
      {key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()"},
      {key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"},
    ]}, {source: "/auth/:path*", headers: [
      {key: "Referrer-Policy", value: "no-referrer"},
      {key: "Cache-Control", value: "no-store"},
    ]}, {source: "/pilots/:path*", headers: [
      {key: "Cache-Control", value: "no-store"},
    ]}];
  },
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  outputFileTracingIncludes: {"/regulations": ["../../docs/CONSTITUTION.md"]}
};

export default withNextIntl(nextConfig);
