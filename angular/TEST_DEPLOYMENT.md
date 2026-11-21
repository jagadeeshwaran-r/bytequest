# ByteQuest Angular — isolated staging deployment

## Existing isolation (already committed)

- Git branch: `test/angular-migration`. Never merge into `main` for testing.
- Build: `npm run build --prefix angular`. The root `vercel.json` provides the Vercel build/output settings.
- GitHub Actions: `.github/workflows/angular-branch-preview.yml` builds and writes `branch-preview/` to **this branch only**. It does not request `pages:write` or deploy to GitHub Pages.
- The live site at `https://jagadeeshwaran-r.github.io/bytequest/` is unchanged.
- The staging UI currently uses the real public problems API and a browser-only guest Java Run. A read-only Firebase login adapter, profile view and leaderboard view are also included, but login requires explicit authorization of the staging domain in Firebase. Verified submissions, editorials, creator Studio, writable social/chat, and rank/streak writes remain in the legacy production UI.

## Deploy to your connected Vercel account without merging

1. In Vercel, choose **Add New → Project**, then import the existing GitHub repository **jagadeeshwaran-r/bytequest**. Use a **new project** such as `bytequest-angular-staging`—do not connect or change the production GitHub Pages deployment.
2. Keep **Root Directory** at the repository root `./` because the Angular catalog/runtime export scripts read the existing `dist/` sources. The root `vercel.json` sets the install, build and output paths.
3. In the new project's Git settings, select **Production Branch = `test/angular-migration`**. This publishes a Vercel project from the isolated test branch; it does not touch the production ByteQuest site.
4. Deploy. Record the URL shown by Vercel and confirm `/`, `/#/problem/two-sum`, `/catalog.json`, `/java-runtime/runner.html`, and `/java-runtime/java-runner.jar` return properly.
5. Test Java Guest Run, dark/light theme, editor drafts, and the published problem list. Do not assume Java Guest Run is a verified submission.
6. For any later Google sign-in migration, explicitly authorize only the stable staging domain in Firebase Authentication → Settings → Authorized domains and assess staging data isolation first. Dynamic preview URLs are **not** automatically authorized; do not open up production security policies.

## Security and release controls

Never configure production service-role secrets in the Angular static app or Vercel public environment variables. Publishable Supabase keys and Firebase web config are not service-role credentials. During this migration, do not enable any production-data mutation in staging without an explicit data isolation plan. The existing Vercel project, if any, should not be changed.

## Current gap

A full Angular feature-parity migration (C/C++/Python Run, authenticated verified submissions and private judge, progress sync, profile editing, messaging, creator Studio, moderation, maintenance gate, offline/connection failure screens) is not yet complete. Do not market this preview as a full replacement until regression/permission tests pass for every feature.
