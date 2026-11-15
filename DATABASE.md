# ByteQuest backend and operations

This guide describes the current Firebase identity and Supabase data architecture. The static interface is hosted on GitHub Pages. Java Run executes in the browser; Python/C/C++ runs and signed-in submissions in all four languages use the verified execution API.

## Deployment configuration

| Component | Current configuration |
| --- | --- |
| Website | https://jagadeeshwaran-r.github.io/bytequest/ |
| Firebase project | `bytequest-7b841` |
| Firebase auth domain | `bytequest-7b841.firebaseapp.com` |
| Supabase project | `zwubrziriuppkldrdoos` |
| Account function | `bytequest-firebase` |
| API base | `https://zwubrziriuppkldrdoos.supabase.co/functions/v1/bytequest-firebase` |
| Function entrypoint / import map | `index.ts` / `deno.json` |
| Browser SDKs | Firebase 13.3.0; server dependencies pinned in `deno.json` |

`dist/firebase-config.js` contains public Firebase web configuration. Keep its server copy, `supabase/functions/bytequest-firebase/domain/firebase-config.js`, identical; account deletion uses that project’s public web API key. `dist/config.js` contains the Supabase URL and a browser-safe publishable key. These files must never contain a service account, private key, OAuth client secret or Supabase service credential.

For a separate deployment, create your own projects, replace the public configuration, update the fixed Firebase project in the function entrypoint, enable Google's sign-in provider, and configure Firebase authorized domains. Update the function's exact `allowedOrigins` list for that deployment. Localhost is not allowed by the production API.

## Identity and authorization

1. Firebase handles Google sign-in and browser session persistence.
2. The browser sends a current Firebase ID token with every private API request.
3. The Edge Function verifies RS256 signatures using Google's fixed certificate endpoint, the exact Firebase issuer/audience, expiry, issued/authenticated times, Google provider and verified email.
4. Ownership is derived as `firebase:<projectId>:<uid>`. Request-body owners, emails and admin flags cannot grant access.
5. Database calls run through the server-side Supabase client and enforce the verified owner again in the relevant operation.

The function gateway uses `verify_jwt=false` because it receives Firebase tokens rather than Supabase tokens. This does **not** make private actions anonymous: application-level Firebase verification is mandatory. Only the `/health` GET and CORS preflight are unauthenticated. The function does not perform an Admin SDK revocation lookup on every request; a signed token may remain valid until it expires.

Private account tables have RLS enabled and are denied to direct `anon` and `authenticated` roles. Service-only functions explicitly revoke browser/public execution. The `SUPABASE_SERVICE_ROLE_KEY` is read only from the Edge Function environment.

## Data model

| Table | Purpose |
| --- | --- |
| `bytequest_problems` | Published problem content and private unpublished drafts |
| `bytequest_firebase_profiles` | Verified Firebase identity records |
| `bytequest_firebase_progress` | Private progress payload and optimistic revision |
| `bytequest_social_profiles` | Username, public profile fields and privacy preferences |
| `bytequest_follows` | Following relationships between public profile identifiers |
| `bytequest_presence_sessions` | Per-page activity leases, sequence numbers and last activity |
| `bytequest_problem_authors` | Ownership of learner-created problems |
| `bytequest_firebase_editors`, `bytequest_library_admins` | Explicit elevated library permissions |
| `bytequest_problem_private` | Private test suites, excluded from the public catalog |
| `bytequest_problem_history` | Problem revisions and correction notes |
| `bytequest_announcements`, `bytequest_notification_reads` | In-app problem updates and per-account read cursors |
| `bytequest_chat_messages`, `bytequest_chat_limits` | Participant-only chat, retry nonces and send quotas |
| `bytequest_live_events`, `bytequest_online_announcements` | Durable delivery and online-transition cooldowns |
| `bytequest_submissions` | Accepted source, optional sharing, explanations and execution measurements |
| `bytequest_online_limits` | Per-account online-compiler rate limits |

Legacy Supabase-auth tables are retained separately. Firebase accounts are namespaced and are not linked to old accounts by matching an email address.

### Schema evolution

SQL files are successive schema snapshots and changes, rather than an automatic installer. The hosted project has already applied them; do not re-run creation scripts there. For a fresh project, review their dependencies in this order:

1. `database/schema.sql`, then `database/seed.sql`
2. `database/firebase.sql`
3. `database/community.sql`, then `database/private-judge.sql`
4. `database/profile-photos-dashboard.sql`, then `database/profile-presence.sql`
5. `database/community-authorship-online.sql`
6. `database/active-presence.sql`, then `database/presence-expired-last-seen.sql`
7. `database/social-defaults-and-friend-presence.sql`
8. `database/leaderboard.sql`
9. `database/points-and-awards.sql`
10. `database/account-removal-functions.sql`
11. `database/social-live.sql`, then `database/submissions-and-solving.sql`
12. `database/submission-metric-consistency.sql`

Use new reviewed migrations for later changes. Keep all private-table RLS, function grants and ownership predicates in place.

## Progress and privacy

Guest work stays in localStorage on its browser/origin. Signed-in accounts have a separate local cache and a private cloud progress row. Guest records are imported only when the learner chooses **Bring guest progress**.

Saves include an expected revision. A stale writer receives the current payload, merges by field timestamp and retries. First-solve dates retain their earliest timestamp. Drafts are saved per language; notes, reviews and backups stay account scoped. Responses from an old account are discarded after an account switch.

New profiles default to discoverability and status sharing. Existing saved opt-outs remain in effect. Turning discoverability off removes the profile from other learners' searches, profiles, social lists and leaderboards. It does not delete progress or existing follow relationships. Public profile responses exclude owner IDs, email, drafts, notes and raw progress.

### Photos

Device images are cropped/resized to 256×256 JPEG in the browser, stripping original metadata. The backend accepts at most 192 KB and derives the caller's upload path. The private `bytequest-avatars` bucket is provisioned lazily. API responses contain ten-minute signed URLs; the bucket is not public. External HTTPS avatar URLs remain optional.

### Activity and presence

Online presence requires a visible, focused page and input within 30 seconds. Per-page sequence numbers reject stale updates; multiple active tabs are combined. Blur, hide, sign-out and page close send inactive updates when possible, while server expiry covers lost requests. Background API polling does not extend the lease.

Profile status displays a radar dot while online and relative last-seen time otherwise. Status sharing is checked before another learner receives presence data. A friend's offline-to-online transition can create a five-second banner on a focused page. Initial online snapshots remain quiet, and rapid reconnects have a 15-second cooldown. Friend alerts refer to people the viewer follows and are in-app only.

## Leaderboards

`bytequest_leaderboard(viewer_id, board_scope, ranking_period, page_number)` is a service-only, security-invoker RPC called through the Firebase-verified API.

| Rule | Behavior |
| --- | --- |
| Global scope | All discoverable profiles |
| Friends scope | The viewer's discoverable profile and discoverable accounts they follow |
| Score | Easy 10, Medium 25, Hard 50 points per first solve of a currently published problem; only valid positive timestamps |
| Periods | All time, UTC week starting Monday, UTC month |
| Exclusions | Unknown/draft/unpublished problem IDs, invalid values and future timestamps |
| Ties | Competition rank by total points; username orders tied rows |
| Pagination | 25 profiles per page; the viewer's rank is returned separately |
| Privacy | Only selected profile fields and aggregate points/counts; no raw progress or account identity |

Avatars for list entries and the viewer are signed before returning. The API accepts only validated scope/period/page values and always supplies the viewer from the verified token. Rankings are motivational, self-reported practice records, not trusted contest results. Changes appear after progress sync; the page's **Refresh** button fetches current rankings.

Profile ranks use the global all-time board, with the same published-problem and timestamp filters. Private profiles can see their own points but have no public rank. The first three shared ranks receive gold, silver and bronze cups. Role badges are read from the server administrator table.

`bytequest_friend_analytics(viewer_id, targets)` accepts up to 100 public profile UUIDs in one batch. It returns only followed, discoverable learners with public profile fields, UTC first-solve dates and topics. It excludes malformed/future dates and unpublished problem IDs. The client can select multiple or all followed friends; colors, photos/initials and crosshair details identify each series. Friend comparison controls appear only on the viewer’s own profile. Animation respects reduced-motion preferences.

## Account removal

The shared account menu and **Edit profile** expose account removal. The learner types `DELETE` and verifies their Google identity. The API requires a verified Firebase token and recent `auth_time` (five minutes) for a new removal; request-body owner IDs are ignored.

`bytequest_begin_account_deletion` acquires an account advisory lock, writes a SHA-256 owner tombstone, deletes unpublished authored problems, anonymizes retained revision attribution and removes the Firebase profile. Foreign keys remove private progress, public profile, follows, presence sessions, author/role links, read cursors, compiler limits, chat messages, live events and accepted submissions. Published problems and their private tests remain part of the community library without the deleted account's attribution.

The API then removes the uploaded Storage photo, deletes this project's Firebase Authentication user through Google's fixed Identity Toolkit endpoint, and marks the removal complete. It never deletes the person's Google account. Failed cleanup is retryable; a pending job allows the verified owner to finish it without recreating their profile. `bytequest_touch_active_account` uses the same lock and rejects tombstoned identities, preventing an old token from resurrecting removed records.

`bytequest_account_deletions` is private, RLS-enabled and inaccessible to browser roles. It retains only an owner hash, request/completion times, and a photo path until cleanup completes. The current browser clears the removed account's local progress/drafts and signs out. Offline caches on other devices are outside this server's control and can be cleared in those browsers.

## Problem authoring and permissions

Every verified learner can create problems and manage their own authored problems. The backend records ownership in `bytequest_problem_authors`; changing a request field cannot claim someone else's problem. Elevated editors and library administrators can manage the full catalog. The original bundled library remains protected from ordinary author edits.

In **Problem studio**, supply the statement, examples, Java contract, teaching notes, public tests, optional private tests and company metadata. Validate the reference in real Java, then save a draft or publish. Supported values are `int`, `int[]`, `boolean` and ASCII `String`. Imports support packs of up to 500 definitions; each save still goes through validation and authorization.

`bytequest_save_problem` performs the ownership/role check, revision comparison, content/private-suite updates, history and announcement in one transaction. Updating a published problem requires a correction note. A stale revision is rejected. Unpublishing removes the challenge from the public catalog and related announcement feed.

Only deliberately enrolled library administrators can delegate creator/editor permissions through **Manage creators**. No first-visitor promotion or client-controlled grant exists. Owner/admin enrollment must use a verified account ID in the owner dashboard, never a user-editable profile claim.

The inbox returns up to 50 announcements for currently published problems and an account-specific read cursor. It does not send email or push notifications.

## Code execution

### Java

CheerpJ loads the Java 17 compiler/runtime in a dedicated iframe. The bridge compiles `Solution` and a generated harness, invokes public tests and compares return values. Runtime/compiler preloading begins while reading problems when the browser permits it. A 120-second startup limit and 30-second compilation watchdog provide recovery; Stop resets the runner. Cold startup remains dependent on download, device and cache conditions.

### Python, C and C++

The verified function generates a public-test harness and sends it to a fixed Wandbox endpoint. Current compiler identifiers are pinned in `online-judge.js`. Source, generated code, case count and output are bounded. Runs require sign-in, with at least five seconds between runs and a maximum of 60 per account per hour. Provider requests use `save:false`; no account token, profile data or private suite is forwarded.

### Private Java suites

Private test attachments and a Judge0 adapter are implemented, but the hosted private judge is **not configured**. A challenge requiring hidden acceptance cannot complete until a trusted isolated server judge is connected. Public-case practice remains available.

To connect a trusted provider, configure these server-side values:

- `BYTEQUEST_JUDGE0_URL`: HTTPS base URL of the isolated judge.
- `BYTEQUEST_JUDGE0_KEY`: optional `X-Auth-Token` secret.
- `BYTEQUEST_JAVA_LANGUAGE_ID`: the provider's verified Java language ID.

The adapter requires network isolation and resource limits. Never run visitors' source directly in an application server process. Private inputs and expected values are excluded from learner responses.

## Deploy and verify

Deploy the complete `supabase/functions/bytequest-firebase/` tree, including `deno.json` and all `domain/` files. Set entrypoint `index.ts`, import map `deno.json`, and `verify_jwt=false` while preserving application-level Firebase verification. The platform supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

```sh
npm ci --ignore-scripts
npm run build
npm test
```

The test suite covers real Java/native execution, owner isolation, author permissions, revision handling, presence, friend alerts, safe rendering and leaderboard requests. The browser and server domain contracts must remain identical where asserted by the tests.

Rollback-only SQL checks include `tests/leaderboard.sql`, `tests/upgrades.sql`, `tests/social-presence.sql`, and the `database/verify-*.sql` access checks. Run them as an operator, inspect their returned verification result, and confirm fixtures were rolled back. Use disposable fixture identities rather than modifying real users for testing.

After deployment, verify `/health`, confirm an unsigned private request returns 401, run security advisors, and test the live UI with an existing authorized session. GitHub's workflow independently builds/tests the frontend before publishing. Monitor actual provider quotas and keep exported backups; this documentation does not promise unlimited free usage.

## Friend chat and live delivery

`bytequest_chat` exposes list/thread/send/read only through the Firebase-verified service API. Sending requires mutual follows and discoverability, a 1–2,000-character body and a UUID retry nonce. The same sender/nonce cannot create duplicate messages or notifications. Sends allow one per second and at most 60 per ten minutes. Threads page in blocks of 50 using numeric cursors. Unrelated callers cannot read them. Existing participants retain history after unfollowing, with private peers anonymized in responses.

`bytequest_update_presence_live` wraps the existing sequenced presence lease and writes events on real offline-to-online transitions. `bytequest_live_events_read` returns only the caller’s queue and unread count, rechecking follow/privacy/current status before delivery. The first connection creates a quiet baseline; later cursors return at most 100 events. Fresh baselines remove events older than seven days. Authorized POST streams last at most 50 seconds and reconnect using a saved per-account cursor; interrupted streams fall back to short polling. Tokens are never placed in query URLs. Website notifications require the site to be open; they are not device push.

## Solving days and accepted submissions

`bytequest_profile_activity` derives accepted UTC days from server-accepted submissions and compatible solve/review records. Visits, attempts, invalid calendar dates and future dates do not extend a streak. A streak can remain current through yesterday until today’s solve. Profiles show solved/total published problems, rank and total points; redundant activity totals and chart-data tables are omitted.

`submission-create` loads the current published revision and private suite from the database, ignores client owners/scores and claims the shared online-execution quota. `benchmark.js` builds one warm-up plus three measured public-suite passes. Only correct repeated runs with valid nonce-tagged measurements can be recorded. Public compiler requests use the fixed Wandbox endpoint, contain only code/public inputs and request no permalink. Versions: OpenJDK 21, CPython 3.11.10 and GCC 13.2. Browser Java Run remains Java 17. Hidden-suite problems fail closed unless a trusted private Java judge is configured; that judge checks public and hidden cases together. Hidden inputs never go to Wandbox.

Acceptance atomically updates private progress and accepted days, advancing the optimistic revision. `bytequest_submissions` unlocks shared solutions only after a server-owned accepted record for that current revision. Self-reported progress cannot satisfy the gate. Ranking/history lists omit source; another learner’s source read additionally requires explicit sharing and a discoverable author. Own private history is available. Each author contributes one best shared result per language, with separate runtime/memory rankings and unmeasured values excluded. Corrections invalidate older unlocks.

Runtime includes harness/serialization/output overhead. Memory is whole-process peak RSS, not auxiliary space. Measurements are estimates affected by provider scheduling and in-process instrumentation tampering, rather than trusted contest scores. Big-O annotations are optional author explanations. A private judge reports its own metrics instead of the public warmed median. RLS and service-only RPC grants protect all new tables. Account deletion cascades through messages, events and submissions.

`node tests/next-features.mjs` verifies four-language harnesses, repetition checks, authenticated streaming, hidden-input isolation and revision gates. `tests/social-submissions.sql` uses rollback-only database fixtures to verify permissions, nonces, unread state, online privacy, source gates, ranking, streaks and deletion cascades. Validation does not message real learners or delete real accounts.
