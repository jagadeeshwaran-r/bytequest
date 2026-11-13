# ByteQuest

A small, playful problem-solving playground for learning Java. Made for a Java / Spring Boot backend developer building confidence with easy interview problems.

## Included

- 16 complete, runnable quests across 9 topics, with 81 built-in checks.
- Real Java 17 compilation and execution in the browser using CheerpJ 5's OpenJDK.
- Java editor with syntax coloring, indentation, autosaved per-problem drafts and Ctrl/Cmd+Enter.
- Run sample/custom cases; submit against all built-in cases plus custom cases.
- Compiler messages, wrong-answer comparisons, Java exceptions and captured console output.
- Pattern guides, invariants, complexity and trade-off notes, progressive hints and reference solutions.
- Step-by-step animations for every quest. These trace the reference algorithm; they do not instrument your submitted code.
- Learn mode first, optional 20- or 30-minute focus timer in Challenge mode.
- 100 XP per first accepted quest, confidence notes, activity history, streaks and topic progress.
- 2 / 7 / 21-day reviews after first completion; 20 XP for a completed due review.
- Guest practice without an account, plus Google sign-in through Firebase and private progress sync in Supabase.
- A live database problem library and editor-only studio for adding, validating, drafting and publishing challenges without redeploying.
- JSON backup export and merge restore, including older ByteQuest backups.
- A clean blue-and-white interface with playful topic colours and a responsive practice workspace.
- Responsive mobile layout and reduced-motion support.

## Publish free with GitHub Pages

1. Create a **public repository** named **bytequest** in your GitHub account. Keep the default branch named **main**.
2. Copy this entire project into it, including **.github/workflows**. Do not upload only the ZIP file.
3. In the repository, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
4. Push the files to main. If you uploaded files before enabling Pages, open **Actions → Build, test and deploy ByteQuest → Run workflow**.
5. The workflow builds the Java bridge, verifies every reference solution, and publishes the dist directory. Open the website link shown in the deployment job or in **Settings → Pages**.

If you use Git from your computer:

    cd bytequest
    git init
    git add .
    git commit -m "Build ByteQuest Java playground"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/bytequest.git
    git push -u origin main

Replace YOUR_USERNAME with your GitHub username. Use your normal GitHub sign-in/SSH setup. The repository must be public to use Pages with GitHub Free. Hosting and browser execution have no per-run bill for this personal educational use; GitHub and CheerpJ terms still apply.

**Important:** GitHub Pages hosts the static interface. Java runs on each visitor's device in a browser JVM. GitHub Actions builds the small bridge at deploy time; it does not execute visitors' submissions.

## Run locally

Requirements: Node 22+ and a full JDK 17+. Install the pinned verification dependencies with `npm ci --ignore-scripts` first.

    node scripts/build-java.mjs
    node tests/verify.mjs
    npx --yes http-server dist -p 8080 -c-1

Open http://localhost:8080. Use an HTTP server with Range support. Opening index.html directly, or Python's basic http.server, is not suitable for CheerpJ.

The prebuilt dist/java-runner.jar is included, so you can preview the static files without rebuilding the bridge. Rebuild after editing java/JavaRunner.java.

## How Java execution works

The app hands the editor text and generated test expressions to the judge module. A separate iframe loads the CheerpJ runtime from its official CDN and opens java-runner.jar in library mode.

JavaRunner.run writes Solution.java and a generated test harness into a temporary virtual directory. The actual JDK compiler compiles both. A fresh class loader invokes the tests, compares Java return values, catches per-case exceptions and returns JSON to the interface.

- Each test gets a fresh Solution instance.
- Array results use deep equality. Two Sum permits either index order.
- The runner captures up to 24 KB of standard output / error.
- Java startup has a 120-second wait limit. Once compilation begins, a 30-second browser watchdog stops the iframe. A visible Stop button lets you reset it sooner.
- Compiler/initialization time is not included in the displayed execution duration. Local times vary by device and browser and are not LeetCode performance scores.
- A slow network or runtime download may require a retry. The initial JDK download is larger than the site; browsers cache runtime resources for later runs.
- Browser sandbox limits apply. This is a personal learning tool, not an adversarial online judge. Cases are public and inspectable. Do not treat the checks, XP or local progress as trusted competition scores.
- For a future multi-user competition platform with secret tests and trusted scores, add an authenticated backend plus a properly isolated judge service. Do not run arbitrary visitors' Java directly in a Spring Boot process.

## Database and Google sign-in

Firebase Authentication handles Google login using project **bytequest-7b841**. The connected Supabase project remains **ByteQuest** (`zwubrziriuppkldrdoos`, Mumbai), with 16 published problems.

The browser calls the `bytequest-firebase` Supabase Edge Function with its Firebase ID token. The function verifies Google's signature, the exact Firebase issuer/audience, expiry, Google provider and verified email before reading or writing the account's records. It derives the owner from that verified token. Users cannot select another account by submitting a user ID. An explicit database allowlist controls editor access.

`dist/firebase-config.js` contains only Firebase's public web configuration. `dist/config.js` contains only the Supabase URL and publishable key. The service-role credential is available only inside Supabase's function environment. No service account, Google client secret or private API key belongs in the static site or repository.

See [DATABASE.md](DATABASE.md) for deployment, editor enrolment, future problem publishing and security checks. GitHub Pages continues to host the website; visitors' Java still executes locally.

## Privacy and persistence

Guest drafts, notes, solved state and practice history stay in localStorage on the current browser and origin. After Google sign-in, each account uses its own local cache and private Supabase progress row. Newer draft/note edits merge by field timestamp; solved dates retain their earliest value. Simultaneous cloud saves use revision checks to prevent blind overwrites. Offline changes remain on the device and retry when online. Synced progress is personal learning data, not a trusted score.

Guest progress is imported only when you choose **Bring guest progress** in the account dialog. Signing out returns to guest mode and leaves the account cache on that browser; clear site data on a shared device after exporting any work you need. **Backup** and **My progress → Restore backup** still work without an account. Restoring merges records rather than deleting current progress.

Signed-in source drafts and notes are stored in Supabase for sync; Java compilation/execution still happens locally in the browser. The page also loads the Firebase SDK from a pinned Google CDN URL, CheerpJ's runtime from its official CDN, and fonts from Google Fonts. See the site's [privacy notice](https://jagadeeshwaran-r.github.io/bytequest/privacy.html).

Reviews are computed when you open the site. There are no background notifications. Reviews target day 2, day 7 and day 21 from first completion; a late review advances its stage, so another overdue stage may become immediately due.

## Add a problem

After signing in with an enrolled editor account, open **Problem studio**. Create or import a definition, supply examples and edge cases, teaching notes, Java starter/reference code and optional animation steps. Validate the reference solution in real Java before checking **Published** and saving. Drafts are visible only to editors. Uncheck Published to remove a challenge from the public library while retaining it in the database. Counts and topic filters update automatically.

Problems support `int`, `int[]`, `boolean` and ASCII `String` parameters/results. Linked lists, trees, graphs and interactive stdin are not part of the current judge protocol. Published cases and reference solutions are public and inspectable.

The bundled `dist/problems.js` catalog is a connection-failure fallback. To update that fallback, edit it and `dist/traces.js`, then run `node tests/verify.mjs`. The live Supabase catalog is authoritative while connected; use the studio for routine additions. See [DATABASE.md](DATABASE.md) for schema and import details.

## Files

| File | Purpose |
| --- | --- |
| dist/index.html, dist/style.css, dist/theme.css | Interface, blue/white theme, responsive layout and animations |
| dist/app.js, dist/progress.js | Practice, account-aware progress, merges, backups and reviews |
| dist/cloud.js, dist/config.js | Public catalog and authenticated progress API |
| dist/firebase-session.js, dist/firebase-config.js | Firebase login, persistence and safe account switching |
| supabase/functions/bytequest-firebase/ | Firebase token verification and private account/editor API |
| dist/studio.js, dist/catalog.js | Editor studio and validated problem definitions |
| database/ | Schema snapshot, seed catalog and transactional access checks |
| DATABASE.md | Firebase configuration, backend deployment and editor setup |
| dist/problems.js | Quest content, Java templates and test data |
| dist/traces.js | Guided reference-algorithm traces |
| dist/judge.js, dist/runner.html | Browser-JVM orchestration |
| java/JavaRunner.java | Real Java compiler/test bridge |
| scripts/build-java.mjs | Build the bridge JAR |
| tests/verify.mjs | Native JVM verification of the catalog and runner |
| .github/workflows/pages.yml | Free GitHub Pages publishing workflow |

## Licensing and credits

Application source is released under the MIT license in LICENSE.

**Built with [CheerpJ](https://cheerpj.com/)** by Leaning Technologies. CheerpJ is a separate runtime with its own license, not part of this app's MIT license. The runtime is loaded from the official CDN; it is not bundled or redistributed. Personal, educational and hobby use is covered by the Community tier. Keep the visible credit. Check the current vendor terms before using this for an organization, a commercial team product, or self-hosting the runtime.

The Google Fonts families DM Sans, DM Mono and Space Grotesk are fetched from Google Fonts and have their own font licenses. A system-font fallback is provided.

Official references (checked November 13, 2026):

- [GitHub Pages overview and free-plan availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages deployment workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [CheerpJ 5.0 and its full browser JDK](https://cheerpj.com/cheerpj-5-0-released/)
- [CheerpJ documentation](https://cheerpj.com/docs/overview)
- [CheerpJ licensing](https://cheerpj.com/docs/licensing.html)

- [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)
- [Firebase ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase pricing and free-plan limits](https://supabase.com/pricing)

### Profiles, community and authoring

- **My profile / Find explorers:** `community.html`. Optional discoverability,
  username and profile ID, editable name/image/bio, year activity grid, streaks,
  active days, following and followers. Private account data stays private.
- **Quest inbox:** new-problem and correction announcements, with unread counts
  and an account-specific read cursor. In-app delivery; no email/push service.
- **Problem studio:** `studio.html`. Creator-only problem management, original
  Java references, public/private cases, pattern/technique/difficulty metadata,
  correction history and optimistic revision checks. Library admins can delegate
  creator access; the initial admin enrollment still needs owner authorization.
- **Problem packs:** imports up to 500 definitions and validates real Java before
  each save. This release still has the original 16 runnable problems, not 500.
- **Private judge:** attachments and the server adapter are implemented. A trusted
  sandboxed Judge0 instance must be configured before hidden-case acceptance can
  run. Until then private-suite submissions fail closed; public practice works.

See `DATABASE.md` for deployment, privacy, role enrollment and judge configuration.

### Compact dashboard and multiple languages

The default page is now a compact dashboard with daily, monthly and yearly first-solve charts,
a topic filter and topic breakdown. Compare with up to two followed, discoverable profiles;
private code and notes are never part of comparison responses. Dates use UTC consistently.
A small top navigation replaces the sidebar, with profile, community, creator and theme
options in the profile dropdown. Light, dark and system modes persist on this device.

The editor supports Java 17, Python 3.11, C and C++. Java keeps the CheerpJ runner. Other
languages use pinned `@runno/runtime@0.10.3` with a WASI Python/Clang toolchain in a separate
compiler window. `runtime-sw.js` adds COOP/COEP only to `native-runner.html`; the main page
and Firebase popup remain outside that isolation boundary. Results travel through a
random per-run BroadcastChannel. Stop/timeout closes the compiler context. Allow the
compiler popup and keep it open while running; first launch downloads the toolchain.
C array parameters have a pointer plus `<name>_len`; array returns use `IntArray`.
C++ exceptions are unsupported by the WASI compiler. Guides/reference solutions remain
Java, and private hidden-case submissions still require the separate Java server judge.
Each language keeps its own account/guest draft; Java drafts keep their existing keys.

Profile photos can be selected from a device (JPG/PNG/WebP up to 10 MB). The client crops
and resizes to 256×256 JPEG, stripping original metadata. The Firebase-verified backend
limits uploads to 192 KB and the caller's profile path in a private `bytequest-avatars`
Supabase Storage bucket. Profile responses use ten-minute signed links, with no public
bucket policy. The bucket is provisioned lazily at the first upload through Storage's API.
