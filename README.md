# OpenCityVoice

OpenCityVoice is an open-source platform where citizens report issues and suggestions to their municipality: a pothole, a broken street light, an illegal dump or an idea for a better town. One deployment serves many municipalities.

- **Citizens** take a photo, drop a pin and add a short description. Reports are public right away, and anyone can browse, support (vote) and comment. Authors get an e-mail when the status changes.
- **Municipalities** get a map dashboard with filters, statuses, assignment to responsible people, forwarding by e-mail or link, team approval and their own categories and statuses.

## Features

| Citizens | Municipality |
| --- | --- |
| Mobile-first map and list of reports | Dashboard with map, list and filters (category, status, assignee, date) |
| 3-step reporting: photo, location, details | Status changes with optional note, e-mailed to the author |
| Location from photo EXIF, GPS or map | Assign reports to responsible people |
| Duplicate warning (same category within 50 m) | Forward reports by e-mail or shareable link (no login needed) |
| Votes, comments, public status timeline | Team: join requests, approval, roles |
| Sign in with Google, Facebook, Apple, Microsoft or e-mail link | Categories, statuses, branding, boundary (GeoJSON) |
| E-mail notifications, can be turned off in profile | Platform admin: add municipalities from OpenStreetMap |

English and Slovenian are included. Add a language by copying `messages/en.json` and adding the locale to `src/i18n/config.ts`.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions), React 19, TypeScript
- [Supabase](https://supabase.com): Postgres + PostGIS, Auth, Storage, Row Level Security
- [MapLibre GL](https://maplibre.org) with [OpenFreeMap](https://openfreemap.org) tiles (free, no API key)
- Tailwind CSS 4, [shadcn/ui](https://ui.shadcn.com) on Base UI, Lucide icons
- [next-intl](https://next-intl.dev) for translations, SMTP (any provider) for e-mail

All permissions are enforced in the database with RLS; the app uses the user's session for every write. The service key is only used server-side to read e-mail addresses and send notifications.

## Local development

Requirements: Node.js 22+, pnpm, Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
pnpm install
supabase start            # Postgres, Auth, Storage and Mailpit in Docker
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY from `supabase status`
# (NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY from the Supabase Vercel integration also work)
# Set SMTP_URL=smtp://127.0.0.1:54325 and NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN=true
pnpm dev
```

Open http://localhost:3000. E-mails (magic links, notifications) arrive in Mailpit at http://127.0.0.1:54324.

The seed creates two municipalities (`/ljubljana`, `/kranj`), sample reports and these accounts (password `password123`, local only):

| E-mail | Role |
| --- | --- |
| `admin@opencityvoice.local` | Platform admin |
| `staff@ljubljana.opencityvoice.local` | Admin of Ljubljana |
| `citizen@opencityvoice.local` | Citizen |
| `pending@opencityvoice.local` | Pending join request for Ljubljana |

### Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:db` | Database and RLS tests (pgTAP, needs `supabase start`) |
| `supabase db reset` | Recreate the local database from migrations and seed |
| `pnpm db:types` | Regenerate TypeScript types from the local schema |

## Deployment

The cheapest setup is [Vercel](https://vercel.com) (Hobby or Pro) and [Supabase](https://supabase.com) (Free or Pro). Any Node.js host works.

1. Create a Supabase project and run `supabase link` and `supabase db push`.
2. In Supabase Auth, set the site URL and add `https://your-domain/auth/callback` to redirect URLs. Enable the OAuth providers you need.
3. Set the environment variables from `.env.example` on your host. `NEXT_PUBLIC_AUTH_PROVIDERS` lists the enabled providers, e.g. `google,facebook`. For a deployment that serves one municipality (e.g. on the municipality's own domain), set `SINGLE_MUNICIPALITY` to its slug: `/` opens that municipality, the header shows its name and logo, and other municipalities return 404. `DEFAULT_LOCALE=sl` shows Slovenian until a user picks another language. `OPERATOR_NAME` and `OPERATOR_EMAIL` fill in the privacy policy and terms of use; review `src/content/legal.ts` for your deployment.
4. Use a transactional e-mail provider (Resend, Postmark, SES, ...) for `SMTP_URL`, and configure the same SMTP in Supabase Auth for sign-in e-mails.
5. Sign in, then mark your profile as platform admin: `update profiles set is_platform_admin = true where id = '<your user id>';`. Add municipalities at `/admin`.

## Project structure

```
messages/                 Translations (en, sl)
src/app/                  Routes: public pages, /[municipality]/manage, /admin, /profile, /f/[token]
src/app/actions/          Server Actions (reports, dashboard, team, settings, admin)
src/components/           UI and map components
src/lib/                  Supabase clients, data access, e-mail, config
supabase/migrations/      Schema, RLS policies and database functions
supabase/tests/           pgTAP tests
```

## Contributing

Issues and pull requests are welcome. Please run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:db` before opening a PR.

## License

[MIT](LICENSE)
