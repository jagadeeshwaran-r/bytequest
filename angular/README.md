# ByteQuest · Angular migration preview

This is **phase 1**, not a production replacement. The existing ByteQuest application in `dist/` remains the only live site, and the existing GitHub Pages workflow is unchanged.

## What works in this preview

- Angular **22** standalone components, strict TypeScript, lazy-loaded routes, Signals, hash-based routing, dark/light themes.
- A read-only problem list derived at build time from the existing `dist/problems.js` catalog (no duplicated problem source of truth).
- A Java 17 editing surface with syntax colors, IntelliJ-style paired `{}` highlighting, auto-inserted brackets, four-space tab insertion, and device-local per-problem drafts.
- A direct link from each problem to the **live ByteQuest** workspace for compilation, Run, Submit, Firebase sign-in, and profile credit.

The preview **does not** execute code, sign users in, write to Supabase, record solves, or claim verified results. Those features remain in the working legacy app until they can be migrated and validated in isolation.

## Development

Requires Node.js `^22.22.3` or `^24.15.0` (or Node 26+) and npm. No global Angular install or `sudo npm` needed.

```bash
git clone https://github.com/jagadeeshwaran-r/bytequest.git
cd bytequest
git checkout feature/angular-migration-foundation
cd angular
npm install
npm start
```

Open `http://localhost:4200/`. The `start` command first exports safe published problem definitions from the canonical JavaScript catalog. This writes an ignored `angular/public/catalog.json`.

To build a static preview:

```bash
cd angular
npm run build
```

Serve `angular/dist/angular-preview/` over HTTP. The router uses hash routes and a relative base href, so it can be hosted under a GitHub Pages subdirectory without server-side rewrites. **Do not replace the root Pages deployment with this output yet.**

For verification run `npm run test:catalog`, `node --experimental-strip-types --test tests/angular-editor.mjs` from the repository root, and the Angular build. Pull requests touching the preview run a separate CI workflow and upload a static build artifact, not a deployment.

## Next migration phases

1. Move the full editor behaviour (all four languages, undo, language-specific templates, contract diagnostics) into Angular components.
2. Introduce a typed API client and Firebase session adapter; keep existing verified Supabase endpoints, never embed a service-role key.
3. Move Run, Submit and private judge workflows behind parity tests before recording any progress from Angular.
4. Migrate profiles, social features, streaks, calendar and leaderboard incrementally.
5. Compare performance, accessibility, routing and submission verdicts against the current app; only then plan a controlled production switch.

## Safety principles

The preview persists drafts under `bytequest.angular-preview.draft.java.` only and uses a distinct theme setting. It cannot read or overwrite the live site's stored progress. Backend/data schema is not changed. Existing CI/CD deploys only `dist/` from `main`.
