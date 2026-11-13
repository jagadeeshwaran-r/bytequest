# ByteQuest database and account setup

The website stays on GitHub Pages. Supabase supplies Postgres, Google authentication and private cross-device progress. Java runs locally in the visitor's browser using the existing real Java runner.

## Installed now

- Project: **ByteQuest**, ref `zwubrziriuppkldrdoos`, Mumbai (`ap-south-1`), Free plan.
- API URL: `https://zwubrziriuppkldrdoos.supabase.co`.
- Three RLS-protected tables: `bytequest_problems`, `bytequest_progress`, `bytequest_admins`.
- 16 published problems, including Java templates, cases, teaching notes and animation steps.
- Owner-only progress, separate editor permissions, optimistic revision checks and no public write grants.
- `dist/config.js` includes the publishable key. This key is designed for the browser; it is not a secret. Never replace it with a secret or service-role key.

Google OAuth is **not activated yet**. No learner or editor account has been enrolled. The site remains usable in guest mode. Google Cloud Console was unavailable in the setup browser, so the following activation is still outstanding.

## Activate Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/auth/overview), select or create a project for ByteQuest and configure Google Auth Platform. Choose **External** audience if learners outside your organisation should sign in. Set the app name to **ByteQuest** and your own support/developer email.
2. Request only basic sign-in scopes: `openid`, `email`, `profile`. Use these branding URLs where requested:

   - Homepage: `https://jagadeeshwaran-r.github.io/bytequest/`
   - Privacy: `https://jagadeeshwaran-r.github.io/bytequest/privacy.html`

3. Create an OAuth client of type **Web application**:

   - Name: **ByteQuest web**
   - Authorised JavaScript origin: `https://jagadeeshwaran-r.github.io`
   - Authorised redirect URI: `https://zwubrziriuppkldrdoos.supabase.co/auth/v1/callback`

4. Open [Supabase Authentication settings](https://supabase.com/dashboard/project/zwubrziriuppkldrdoos/auth/providers). Under **Sign In / Providers → Google**, enable Google and copy the client ID and client secret directly from Google into the Supabase fields. Save them there. Do not paste the client secret into ChatGPT, a GitHub issue, source code, a browser URL or the public repository.
5. Under **Authentication → URL Configuration**, set **Site URL** to `https://jagadeeshwaran-r.github.io/bytequest/` and allow that same exact redirect URL, including the project path and trailing slash. Avoid broad wildcard redirects. A private preview needs its own exact redirect entry if you decide to enable sign-in there.
6. If Google's audience is still in Testing, add the intended test accounts. For public access, complete Google's publishing steps and any verification it requires. Reload ByteQuest and choose **Sign in with Google**. Confirm the correct Google account; the app only requests basic identity information.
7. Verify that the account dialog shows the signed-in email, edit a draft, choose **Sync now**, then reload and confirm the draft returns. Check another browser/device for cross-device sync. These final OAuth checks have not been completed while the provider is inactive.

No site redeployment is required when the provider settings change. The app checks the provider status each time it loads.

## Enrol the owner as an editor

Sign in to ByteQuest once with your intended Google account. In the Supabase SQL editor, inspect authenticated identities:

```sql
select id, email, created_at
from auth.users
order by created_at desc;
```

Verify the intended owner's exact email and UUID. Then insert that verified UUID (replace the placeholder) into the editor allowlist:

```sql
insert into public.bytequest_admins (user_id)
values ('REPLACE_WITH_VERIFIED_AUTH_USER_UUID'::uuid)
on conflict (user_id) do nothing;
```

Sign out/in or reload the website. **Problem studio** appears for that account. Ordinary learners cannot grant themselves this role, change their account owner ID, read another learner's progress or write problems. Do not derive authorisation from editable profile metadata and do not automatically make the first visitor an editor.

To revoke an editor while retaining their learner account, remove only that verified UUID from `bytequest_admins` in the owner dashboard.

## Add problems later

1. Open **Problem studio → New problem**, or import a problem JSON file.
2. Enter a unique lowercase ID such as `array-sum`, title, topic, difficulty, estimate and statement.
3. Define the Java method, parameter list and result type. Supply full `class Solution` starter and reference source. Parameters and returns support `int`, `int[]`, `boolean`, and ASCII `String`.
4. Add 2–100 cases as JSON objects with `args`, `expected`, and `label`. The first two are public examples; all cases are public inspectable learning checks.
5. Add pattern/invariant/complexity notes, at least one hint and optional animation frames. Frames illustrate the reference approach and do not trace arbitrary submitted code.
6. Choose **Validate Java** to compile the reference and run all cases in the browser. Fix failures before publication. Keep the tab open for the initial JVM download.
7. Save a draft or enable **Published** and save. The next library refresh includes the problem without a GitHub deployment. Edit and save existing items to update them; stale editor revisions are rejected instead of overwriting another editor's changes. Unpublish to retain an item privately.

Array results normally use ordered equality. An imported `int[]` problem can set `"normalize": "sort-int"` when element order should be ignored, as with Two Sum indices. Preserve this field when importing/exporting definitions.

The studio saves unfinished forms to a local cache per editor account. Saving the form to Supabase is explicit. Reference validation in the UI is a trusted editor workflow, not a server-enforced adversarial judge.

## Schema and verification

`database/schema.sql` is the current schema snapshot. Two migrations have been applied to the hosted project: `bytequest_initial_schema` and `bytequest_progress_payload_guards`. Do not execute the snapshot again over an existing project. Use a new reviewed migration for schema changes.

`database/seed.json` contains the initial catalog. `database/seed.sql` inserts only missing IDs and never overwrites existing editor content. Changing these files alone does not update the live catalog.

`database/verify-access.sql` runs disposable fixtures inside a transaction and rolls them back. It checks public/draft access, editor permissions, owner-only progress, blocked self-promotion and stale revision handling. It passed on the installed hosted database. Supabase's security advisor returned no findings at setup time. `node tests/verify.mjs` checks the 16 Java references / 81 cases, catalog validation, progress merge conflicts and browser config guards.

Progress is private to its owner through the Data API. Project owners with database administration access can still inspect hosted records. XP and completions are self-reported study information. This is not a competition service with secret tests or trusted scores.

## Free operation

GitHub Pages hosts the static app; Supabase is on its Free plan. Monitor the actual [Supabase dashboard usage](https://supabase.com/dashboard/project/zwubrziriuppkldrdoos) and [current limits](https://supabase.com/pricing). Free projects may pause after inactivity, and quotas can change. Keep exported backups. If Supabase cannot be reached, the bundled catalog and guest practice remain available; account work is cached locally until sync succeeds.
