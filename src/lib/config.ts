export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const mapStyleUrl =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";

const supportedProviders = ["google", "facebook", "apple", "azure"] as const;
export type OAuthProvider = (typeof supportedProviders)[number];

export const oauthProviders = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter((p): p is OAuthProvider => (supportedProviders as readonly string[]).includes(p));

/** Slug of the only municipality served by this deployment; unset for multi-municipality mode. Server-only. */
export const singleMunicipality = process.env.SINGLE_MUNICIPALITY?.trim() || null;

export const passwordLoginEnabled = process.env.NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN === "true";

/** Demo account shown as a hint on /login when password login is enabled. Public by design. */
export const demoLoginEmail = process.env.NEXT_PUBLIC_DEMO_LOGIN_EMAIL?.trim() || null;
export const demoLoginPassword = process.env.NEXT_PUBLIC_DEMO_LOGIN_PASSWORD?.trim() || null;

export const providerLabels: Record<OAuthProvider, string> = {
  google: "Google",
  facebook: "Facebook",
  apple: "Apple",
  azure: "Microsoft",
};

export const PHOTO_BUCKET = "report-photos";
export const LOGO_BUCKET = "municipality-logos";

export function logoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${path}`;
}
export const MAX_PHOTOS = 5;

export function photoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

/** Only allow same-origin relative redirects. */
export function safeNext(next: string | null | undefined, fallback = "/") {
  // Browsers treat "/\\host" like "//host", so backslashes would allow open redirects.
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback;
}
