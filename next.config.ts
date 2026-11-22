import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const origin = (url: string | undefined) => {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
};

const isDev = process.env.NODE_ENV !== "production";
const supabaseOrigin = origin(supabaseUrl);
const connectSources = [
  "'self'",
  supabaseOrigin,
  supabaseOrigin.replace(/^http/, "ws"),
  "https://tiles.openfreemap.org",
  "https://server.arcgisonline.com",
  "https://nominatim.openstreetmap.org",
  // A custom style can load tiles, sprites and glyphs from any host.
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ? "https:" : "",
  origin(process.env.NEXT_PUBLIC_MAP_STYLE_URL),
  origin(process.env.NEXT_PUBLIC_SATELLITE_TILES_URL),
  "https://vercel.live",
  "wss://ws-us3.pusher.com",
].filter(Boolean);

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://vercel.live${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "font-src 'self' data:",
  `connect-src ${[...new Set(connectSources)].join(" ")}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src https://vercel.live",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: supabaseUrl
      ? [{ protocol: new URL(supabaseUrl).protocol.replace(":", "") as "http" | "https", hostname: new URL(supabaseUrl).hostname, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
