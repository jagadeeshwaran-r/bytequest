# ByteQuest scheduled maintenance — safe production rollout

## Initial defaults (NOT ARMED)

The migration `database/site-maintenance.sql` seeds this **disabled** draft:

| Field | Value |
| --- | --- |
| Mode | Scheduled |
| Armed/enabled | **false** |
| Start (IST) | **20 November 2026, 01:00** |
| End (IST) | **20 November 2026, 02:00** |
| Start (UTC) | 19 November 2026, 19:30Z |
| End (UTC) | 19 November 2026, 20:30Z |
| Message | We're upgrading ByteQuest to make your coding experience better. |

Never set `enabled=true` in the migration or assume that merging this PR turns maintenance on.
The admin dashboard displays the draft; **Enable schedule** requires a confirmed
Firebase-authenticated `bytequest_library_admins` identity and an explicit confirmation.

## Coordinated deployment — no production downtime required

1. Back up the project before deployment. Confirm you can access the Supabase SQL Editor
   and at least one existing library administrator can sign in with Firebase.
2. Apply `database/site-maintenance.sql` to the existing Supabase project. It only
   adds a private single-row table with RLS and an **inactive** configuration. Existing
   configurations are preserved by `ON CONFLICT DO NOTHING`.
3. Run the read-only query below to verify the draft exists and is disabled.
4. Deploy the matching `supabase/functions/bytequest-firebase/` directory as the
   **bytequest-firebase** Edge Function with `verify_jwt=false` at the gateway:
   Firebase JWT verification remains mandatory inside the handler. Keep the live
   Firebase and Supabase secrets unchanged. **Do not deploy an older server version.**
5. Merge/deploy the PR GitHub Pages `dist/` build. This makes the public maintenance
   status check available on Problems, Community, Leaderboard and Studio.
6. Sign in at `maintenance.html`, confirm the admin role, and verify the draft is still
   **disabled**. Preview the visitor page at `status.html?issue=maintenance` —
   it must say no maintenance is active.
7. Test a non-admin account can still submit/sync before arming. Test an admin
   cannot activate maintenance via forged client fields; backend enforces actual
   verified library administrator membership.

**Do not arm the sample window automatically during rollout.** If the intended
window has already passed when deploying, select a future IST start/end before arming.

## Admin workflow after deployment

- **Save settings only** edits the current configuration without changing
  whether it is armed.
- **Enable schedule** shows a confirmation containing exact IST start/end time.
  The server rejects a past start, end-before-start, or window longer than 7 days.
- **Start maintenance now** requires a valid future end time and confirmation;
  server time, not the device clock, controls the activation.
- **Disable maintenance** immediately permits normal user writes again.
- `maintenance.html` is accessible from the verified library admin's profile menu.
  All other signed-in users get HTTP 403; unauthenticated users cannot manage it.
- During an active window, the visitor page shows the configured message and
  expected return time in IST. The maintenance panel can be opened directly by
  an administrator from that page to end or edit the window.
- The public status endpoint is `GET /functions/v1/bytequest-firebase/maintenance`.
  It is unauthenticated and returns only an *enabled* window; **disabled draft
  details are not exposed**. When the server says upcoming, visitors get a
  non-blocking advance notice.

## Read-only verification

```sql
select enabled,mode,starts_at,ends_at,revision,
       (enabled and now()>=starts_at and now()<ends_at) as scheduled_active
from public.bytequest_site_maintenance where key='site';
```

Fresh install: one row, `enabled=false`, `mode=scheduled`, `revision=0`.
A schedule ends automatically at `ends_at`, without an external cron job.
No update should touch user progress, previous submissions, drafts, or rankings.

## Security and reliability

- Backend rejects non-admin writes at HTTP **503**, `code: MAINTENANCE`,
  during the active window. This includes sync, publishing, submissions,
  chat and profile writes. It does not pretend these succeeded.
- Account/progress *reads*, profile lookup for self, secure reference read,
  Studio listing and explicit account deletion remain available so people can
  recover their information. Those endpoints do not provide a way to write
  practice progress during maintenance.
- Signed-in library admins can bypass frontend maintenance only when the
  backend itself verifies `bytequest_library_admins`; `maintenanceAdmin=1`
  is a request for verification, **not** an admin grant.
- Active maintenance is a **strict client-side site gate**: new navigations
  check the authoritative server schedule before importing application code,
  and active sessions are redirected to the maintenance page on polling or
  the scheduled UTC cutoff. Users cannot open the normal UI via a direct HTML
  path, copied problem link, profile URL, runner page, or a different status
  preview while the server reports active maintenance.
- The protected admin console at `maintenance.html` remains the only admin
  control route to turn maintenance off. A URL parameter is not a general
  site bypass. New app pages start only after a successful status check.
- **Tradeoff:** if the public status API cannot be reached, the main pages
  fail closed to the offline/unreachable recovery page rather than guessing
  that maintenance is inactive. Do not rely on ByteQuest local practice to
  work during a status API outage in this strict mode.
- An already-open editor is redirected once maintenance becomes active;
  the existing local draft storage is not cleared, but unconfirmed cloud
  saves remain unconfirmed. Users should save/export beforehand.
- **Important hosting limit:** GitHub Pages is static hosting. Browser gates
  prevent ordinary visitors from *using* other pages, but they **cannot**
  return HTTP 503 for direct requests to an HTML or JavaScript asset. A visitor
  with JavaScript disabled, a custom HTTP client, or a direct GitHub Pages
  asset URL can still retrieve public files. Supabase authenticated write APIs
  are independently protected by the Edge Function. For genuine network-level
  enforcement of only the maintenance page, put the whole site behind a
  controlled edge proxy/custom domain (for example Cloudflare Workers or
  Cloudflare Pages Functions), configure that proxy to serve the maintenance
  HTML and return HTTP 503 for every other HTML route during the active
  server-side window, and stop exposing the unprotected GitHub Pages origin.
- **Important backend drift:** the older deployed Edge Function had different
  external hidden-judge defaults from GitHub. Deploying the reviewed GitHub
  source may change private-judge availability. Verify that separately before
  deployment; never enable external hidden-suite sharing as a workaround.

## Smoke tests

1. Disabled default: site behaves normally, preview says inactive.
2. Planned schedule: visitor pre-warning shows IST start/end and custom message.
3. Active window: a non-admin `sync`, `studio-save` or `submission-create`
   gets HTTP 503; local draft remains. Confirm no new verified submission is counted.
4. Library admin signed in: `maintenance-admin-get/save` succeed; ordinary users
   get 403 even if `admin:true` is supplied in request JSON. The standalone
   admin control panel remains accessible; `?maintenanceAdmin=1` on Problems
   does not bypass the maintenance screen.
5. Visit direct problem, profile, leaderboard, Studio, privacy, Java runner and
   native runner URLs during maintenance. Confirm each is redirected without
   booting its app or compiler runtime. Repeat with `?issue=offline` and
   `?issue=busy` on the status page; both must yield to maintenance.
6. Keep a coding editor tab open when an enabled scheduled window begins.
   Confirm the redirect occurs at the server-time cutoff or next status check,
   rather than leaving the editor accessible.
7. At the exact UTC end cutoff, public status switches to inactive and ordinary
   requests work again; no manual cron or job is required.
8. Revoke admin role and verify the maintenance-control console cannot be used.
9. After reconnecting, use the normal ByteQuest sync flow and confirm actual
   cloud progress. A redirected page alone is not confirmation of a cloud save.
