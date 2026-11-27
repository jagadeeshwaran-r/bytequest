# ByteQuest Angular — merge readiness

**Status: NOT READY TO MERGE.** This branch is deliberately isolated from main.

## Scope
Preserve the existing ByteQuest UI and behavior; migrate native Angular routing, Java 17 Run and verified Submit, profiles, streaks/calendar, leaderboard, followers, chat, notifications, creator/admin workflows, and offline/maintenance handling. Exclude C/C++/Python *execution* only.

## Implementation and verification
| Workstream | Current status | Production gate |
| --- | --- | --- |
| Native routing, original CSS and header | Implemented | Browser and pixel tests |
| Problems, Java editor and browser public Run | Implemented | Complex Java structure E2E |
| Profile, leaderboard and calendar | Native views implemented | Authenticated API and visual checks |
| Profile editing, friends search, chat, updates | Native UI/contract implemented | Isolated staging writes and end-to-end validation |
| Creator Studio and hidden tests | Native editor and local reference checks | Author/publish E2E and security |
| Server submission history and Java answer unlock | Backend-only calls implemented | Authenticated verification E2E |
| Public/private verified submissions, first solves and streaks | Adapter implemented | Staging judge and progression E2E |
| Maintenance gate | Native public status check added | Strict admin/bypass/outage E2E |
| Realtime presence, advanced analytics, avatars, account deletion and progress sync | Incomplete or legacy | Native port and security tests |
| Identical UI, responsive layout | Canonical styles reused | Pixel-compare desktop and mobile |

## Hard blockers
1. **Authenticated browser E2E is still unverified.** The staging site uses a separate Supabase project `ainsxwxvfybhwdennsvh` and the existing Firebase Google provider. Automated tests verify the Firebase project, authorized domain, real OAuth popup, production-data isolation and anonymous HTTP/RLS policy; they do not complete a real user Google sign-in and database mutation in Chromium.
2. **Private Java judging is not configured in staging.** Complete/full hidden-suite acceptance, private-judge timeouts, editor unlock, verified user progress and leaderboard are not end-to-end proven through a real Firebase session.
3. **Full Angular parity is incomplete.** Presence/realtime notifications, advanced analytics, avatar upload, progress sync, maintenance administration, and account deletion remain incomplete or intentionally disabled (staging account deletion MUST remain disabled while using shared Firebase Auth).
4. **Pixel-level UI parity and release rollback are not verified.** Native views still require comparison against the legacy site on phone and desktop.
5. **The main GitHub Pages workflow still publishes the legacy `dist` directory.** Merging currently would not safely switch production to Angular.
6. **Generated artifacts** `branch-preview/` and `branch-manifest/` need removal from the clean release PR.

## Isolated staging verification — 21 November 2026

- **Staging backend:** new Mumbai Supabase project `ainsxwxvfybhwdennsvh`; 26 ByteQuest tables migrated; 16 public starter challenges seeded, 16 reference solutions stored in service-role-only table. No production accounts or submissions copied. All 26 tables have RLS enabled.
- **Staging Edge Function:** `bytequest-firebase` deployed with Firebase JWT verification, staging-origin CORS and a runtime project-ID guard. The function cannot delete shared Firebase accounts, and private hidden cases cannot be sent to an untrusted third-party judge.
- **Live CI HTTP:** [staging API and PostgREST regression](https://github.com/jagadeeshwaran-r/bytequest/actions/runs/44922716267) passed. Real HTTP validated health, maintenance, trusted/untrusted origins, forged and missing tokens, all 16 public REST challenges, and anonymous denial for private references, hidden tests, submissions and progress.
- **Live CI Firebase:** [Firebase staging smoke](https://github.com/jagadeeshwaran-r/bytequest/actions/runs/44922694803) passed for project, authorized test domain, and browser Google OAuth popup initiation; **not** signed-in callback.
- **Real staging database integration:** executed transactionally with rollback; passed profile creation/privacy, mutual follows, chat denial before mutual follow, send/read and nonce idempotency; accepted-submission persistence, duplicate nonce handling, exactly-once first-solve streak/points, leaderboard; creator publish, private references/hidden tests, revision conflicts and unauthorized edits; presence/last seen and private profile visibility.
- **Browser CI:** [Angular Chromium and Java tests](https://github.com/jagadeeshwaran-r/bytequest/actions/runs/44922351784) passed for desktop and mobile guest flows, actual Java 17 Run, editor, failed compile/wrong answer, no production API requests. Authenticated browser acceptance remains a release blocker.
- **User-facing staging:** https://bytequest-angular-staging.vercel.app/#/angular is wired to the **separate** database. First-time Google sign-ins must create a staging profile (no production profile data is imported).
- **Cost/isolation:** the project was quoted at $0/month when created. All staging changes and deployed test assets stay separate from production GitHub Pages and production Supabase.

## Safe release sequence
Configure isolated backend with explicit approval for any billable resource; run authenticated feature parity and browser tests; inspect screenshots and migrations; prepare a clean release PR excluding generated preview artifacts; update the main Pages workflow to build and publish Angular only in the approved final release; review; merge; verify production; keep legacy rollback.

## Test links
Native: https://bytequest-angular-staging.vercel.app/#/angular
Legacy visual reference: https://bytequest-angular-staging.vercel.app/legacy/index.html

**Never merge this branch solely because its frontend build passes.**
