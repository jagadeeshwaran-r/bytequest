# ByteQuest: Firebase login and Supabase data

Google login is implemented with Firebase Authentication. GitHub Pages remains the host, and Supabase retains the problem library and learning progress. Java compilation and execution remain local to the visitor's browser.

## Project configuration

| Component | Actual project / configuration |
| --- | --- |
| Website | https://jagadeeshwaran-r.github.io/bytequest/ |
| Firebase | ByteQuest, project ID `bytequest-7b841`, Spark plan |
| Firebase web app | ByteQuest web, app ID `1:25442282451:web:7b188546eadc81adb75d26` |
| Firebase auth domain | `bytequest-7b841.firebaseapp.com` |
| Supabase | ByteQuest, ref `zwubrziriuppkldrdoos`, Mumbai |
| Account API | `https://zwubrziriuppkldrdoos.supabase.co/functions/v1/bytequest-firebase` |
| Authentication | Google provider enabled in Firebase Authentication |
| Login domains | `jagadeeshwaran-r.github.io` and the existing private Sites preview domain |

`dist/firebase-config.js` is the public Firebase web configuration. `dist/config.js` is the public Supabase project configuration. These identifiers are intended to be included in a browser. Do not replace them with a service account, private key, OAuth client secret, or Supabase service-role credential.

The browser imports Firebase SDK **13.3.0** from Google's CDN. The backend pins **jose 6.2.17** and **supabase-js 2.119.0**. Test dependencies are pinned in `package-lock.json` and installed by CI.

## How private data is protected

1. A learner chooses **Sign in with Google**. Firebase performs the Google sign-in flow and persists the session on that browser.
2. For every private account request, the browser obtains a current Firebase ID token and sends it over HTTPS to the Supabase Edge Function.
3. The function validates the token signature against Google's fixed public-certificate endpoint, RS256 algorithm, exact project issuer and audience, expiration, issued/authenticated times, Google provider, and verified email.
4. The account owner is derived from that verified token as `firebase:<projectId>:<uid>`. User IDs or role flags in a request body cannot select another account or grant editor access.
5. The backend reads or writes only that owner's progress. Publishing requires a row for that exact owner in `bytequest_firebase_editors`, checked again on each editor request.

The private account tables have RLS enabled and no direct grants to `anon` or `authenticated`. Only the backend's service-role client can access them. That credential comes from Supabase's built-in Edge Function environment; it is never returned to the browser or written into source.

The gateway's `verify_jwt` is disabled **only for this function** because it receives Firebase JWTs, rather than Supabase JWTs. The function itself performs the required authentication before all private actions. Only the public `/health` GET and CORS preflight are unauthenticated. CORS accepts the two configured site origins, not a wildcard.

The implementation verifies signed, unexpired ID tokens. It does not perform an Admin SDK revocation lookup on each request; existing Firebase tokens can remain valid until they expire. Editor removal takes effect on the next editor API request because the database allowlist is checked each time.

No Firebase Cloud Function or custom JWT-role claim is needed for this integration. The account API runs on the existing Supabase project.

## Tables and migrations

The original Supabase-auth schema and records are retained. New Firebase accounts use separate namespaced records and are never matched to legacy accounts just by email.

| Table | Purpose |
| --- | --- |
| `bytequest_problems` | Existing public published catalog and private editor drafts |
| `bytequest_firebase_profiles` | Verified Firebase identity, email, creation and last-seen dates |
| `bytequest_firebase_progress` | Private learning backup and monotonically increasing revision |
| `bytequest_firebase_editors` | Explicit editor allowlist |

`database/schema.sql` remains the initial Supabase-auth schema snapshot. `database/firebase.sql` is the additive Firebase migration, applied to the hosted project as `bytequest_firebase_accounts`. Do not reapply these files to an already configured project. Make a new reviewed migration for later schema changes.

Progress saves use a database row lock and expected revision. A stale device receives the current row, merges changes by field timestamp, and retries. Requests from a previous account are bound to that account's captured token and are discarded by the UI after an account switch. Local caches include the Firebase project and UID. Guest progress is imported only through **Bring this device’s guest progress**.

## Enrol an editor

Sign in to ByteQuest once with the intended Google account. In the Supabase SQL editor, inspect the verified account records:

```sql
select user_id, email, created_at
from public.bytequest_firebase_profiles
order by created_at desc;
```

Verify the intended owner email and its exact namespaced user ID. Then insert only that verified ID:

```sql
insert into public.bytequest_firebase_editors(user_id)
values ('REPLACE_WITH_VERIFIED_FIREBASE_USER_ID')
on conflict(user_id) do nothing;
```

Reload ByteQuest. **Problem studio** appears for that editor. Do not make the first visitor an editor, derive permissions from editable profile data, or grant the editor role based on a request body's email or admin flag.

To revoke an editor, remove only that exact ID from `bytequest_firebase_editors` in the owner dashboard. This retains the learner's progress.

## Add problems later

Open **Problem studio → New problem**, or import a JSON definition. Supply a unique lowercase problem ID, statement, constraints, Java contract, starter/reference classes, 2–100 cases, pattern notes, complexity, hints and optional animation frames. The first two cases are examples; all cases remain public learning checks.

Choose **Validate Java** to run the reference against its cases. Save a private draft or enable **Published** and save. The live database library updates without redeploying GitHub Pages. Unpublish to keep an item privately. Stale editor revisions are rejected to prevent overwriting another editor's changes.

Supported Java values are `int`, `int[]`, `boolean`, and ASCII `String`. An imported `int[]` problem may use `"normalize":"sort-int"` when result order does not matter. The studio preserves this on import, editing, and export. Animations illustrate the reference algorithm and do not trace arbitrary submitted code. The publisher is a trusted editor; browser reference validation is a learning-content workflow, not a server-enforced adversarial judge.

## Deploy the account function

The deployed function source is `supabase/functions/bytequest-firebase/`. Include its `deno.json` and all `domain/` dependencies. The domain files are copies of the public problem/progress validation contracts; tests ensure they match. Update both when deliberately changing a contract.

Deploy as **bytequest-firebase** to project `zwubrziriuppkldrdoos`, with entrypoint `index.ts`, import map `deno.json`, and `verify_jwt=false`. The source is pinned to Firebase project `bytequest-7b841`. Changing the Firebase project requires a reviewed update of both the public config and backend issuer/audience settings.

The platform supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Do not expose these secret environment values through UI forms or the repository. A health request to `/health` returns only the Firebase project ID and provider. A private request without a valid Firebase token must return 401.

## Verify changes

```sh
npm ci --ignore-scripts
node tests/verify.mjs
```

This runs 16 real Java reference solutions / 81 cases, existing catalog and backup checks, and Firebase security tests. Firebase tests cover real signed JWTs, tampered signatures, wrong projects, expired tokens, fake request-body owners, editor allowlists and revocation, stale progress revisions, token refresh and account switching. The native tests use disposable signing keys; those keys are never trusted by the deployed function.

`database/verify-firebase-access.sql` runs rollback-only fixtures to verify that browser roles cannot read private account tables, call privileged account functions or promote themselves. It also checks revision conflicts and payload validation. The existing `database/verify-access.sql` covers the retained legacy access model.

For end-to-end testing, sign in on the actual website, add a note or edit a draft, choose **Sync now**, reload and confirm it returns. Sign out and verify guest work stays separate. Test another browser/device for an independent cloud round trip.

Firebase Spark and Supabase Free quotas still apply. No paid plan was enabled for this implementation. Monitor usage in the actual project dashboards and keep exported backups.
