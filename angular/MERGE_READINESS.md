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
1. The currently connected Supabase account contains the live ByteQuest project, but no separate development project/branch. Staging write configuration remains intentionally disabled.
2. Firebase must explicitly authorize the staging domain; Supabase Edge Function must allow that origin for the isolated staging backend. Do not relax live origin checks.
3. End-to-end private Java judging and full-suite acceptance must be verified with isolated test accounts and data.
4. Current main GitHub Pages workflow publishes the legacy dist folder, not the compiled Angular app. Merging now will NOT switch production to Angular.
5. The test branch tracks generated branch-preview and branch-manifest output. Exclude both from a clean release PR.

## Safe release sequence
Configure isolated backend with explicit approval for any billable resource; run authenticated feature parity and browser tests; inspect screenshots and migrations; prepare a clean release PR excluding generated preview artifacts; update the main Pages workflow to build and publish Angular only in the approved final release; review; merge; verify production; keep legacy rollback.

## Test links
Native: https://bytequest-angular-staging.vercel.app/#/angular
Legacy visual reference: https://bytequest-angular-staging.vercel.app/legacy/index.html

**Never merge this branch solely because its frontend build passes.**
