# Try a Pie hold coordinator (Durable Object)

Pages Functions cannot define Durable Object classes, so holds are coordinated by this companion Worker.

## Deploy (required once, and after DO code changes)

Requires a Cloudflare Workers **paid** plan (Durable Objects).

```bash
npm run deploy:holds
```

Then either:
- Keep the `[[durable_objects.bindings]]` entries in the root `wrangler.toml`, or
- In Cloudflare Dashboard → Pages → pizzapilot → Settings → Bindings → add Durable Object:
  - Variable name: `TRY_PIE_HOLDS`
  - Class: `TryPieHoldCoordinator`
  - Worker: `pizzapilot-try-pie-holds`

Redeploy Pages after binding: `npm run deploy:cf` (or push to git if auto-deploy is on).

## Local test (shared holds across isolates)

Terminal 1 — DO Worker:

```bash
npm run dev:holds
```

Terminal 2 — Pages:

```bash
npm run dev:cf
```

`npm run dev` (Express) still uses the in-memory Map fallback (fine for single-process local work).
