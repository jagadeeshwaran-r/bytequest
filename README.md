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
- JSON backup export and merge restore. No account, database, paid API key or server required.
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

Requirements: Node 22+ and a full JDK 17+.

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

## Privacy and persistence

Drafts, notes, solved state and practice history are stored in localStorage on the current site origin and browser. They do not sync between devices or between the preview and GitHub Pages. Use **Save progress** and **My progress → Restore backup** to transfer progress.

Code execution happens in the browser; there is no submission endpoint. The page fetches CheerpJ's runtime from its CDN and fonts from Google Fonts. Browser/runtime caching uses local browser storage. Closing the tab or clearing site data can discard local work; export backups regularly.

Reviews are computed when you open the site. There are no background notifications. On-time reviews target day 2, day 7 and day 21 from the first completion; a late review advances the stored review stage, so another overdue stage may become immediately due.

Restore merges solved records, notes and activity. Existing local drafts win over backup drafts. Keep the downloaded backup if you want to recover its exact code separately.

## Add a quest

Edit dist/problems.js. Use the make helper with:

1. A unique id, title, topic and Java method signature.
2. A clear original statement and explicit constraints.
3. At least two sample cases, followed by additional edge cases.
4. A reference method body, pattern idea, invariant, complexity and hints.
5. A reference trace in dist/traces.js.

Supported parameter and result types are int, int[], boolean and ASCII String. This first version intentionally focuses on arrays, strings, search, stacks, basic math and DP. Linked lists, trees, graphs and interactive stdin are not yet part of its judge protocol.

Run node tests/verify.mjs after adding a quest. Update the displayed quest counts in index.html and app.js if expanding the catalog. The existing structure can grow into your larger study plan.

## Files

| File | Purpose |
| --- | --- |
| dist/index.html, dist/style.css | Interface, responsive layout and animations |
| dist/app.js | Practice, progress, backup and review workflow |
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
