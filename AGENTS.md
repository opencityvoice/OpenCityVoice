<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Supabase projects and migrations

Two live Supabase projects run this app; **every schema migration must be pushed to both**:

| Deployment | Project | Ref |
|---|---|---|
| Medvode | `opencityvoice-medvode` | `aqweqpbunwycnmzenjcs` |
| General / OpenCityVoice | `OpenCityVoice` | `hholkdximvirxkmpswkf` |

After adding a file to `supabase/migrations/`:

```bash
npx supabase link --project-ref aqweqpbunwycnmzenjcs
npx supabase db push --remote
npx supabase link --project-ref hholkdximvirxkmpswkf
npx supabase db push --remote
```

Notes:
- `supabase db push` **without `--remote`** targets the local Docker stack and fails when it isn't running — always pass `--remote` for the live projects.
- Check what is applied vs pending per project: `npx supabase migration list --remote`.
- Local dev stack + pgTAP tests (`pnpm test:db`) need Docker (`supabase start`).
