# Dedicated Java submission judge for ByteQuest

ByteQuest has two distinct execution paths: **Run** stays in the learner's browser
(CheerpJ Java 17); **Submit** always goes through the verified Supabase API.
A Java submission with a configured, trusted Judge0 endpoint now uses that
endpoint for **both public-only and hidden-case** problems. Python/C/C++ keep the
existing Wandbox route. When no trusted judge is configured, the existing Java
Wandbox submission behavior remains in place.

This changes routing, not the hosting infrastructure. The code does **not**
provision a judge or make an existing unconfigured deployment faster by itself.

## Prepare a trusted isolated Judge0 service

1. Provision a dedicated Linux host or isolated compute environment with enough
   memory and CPU for the expected concurrent Java compilers. Use the current
   **patched** official Judge0 CE release and its official deployment guide:
   https://github.com/judge0/judge0/releases and https://ce.judge0.com/docs.
2. Place Judge0 behind HTTPS with access control. Require an API token and
   restrict ingress to trusted service traffic; **never publish an unsecured
   Judge0 port or its backing Redis/Postgres services**. Protect the host from
   source-code execution: use a dedicated VM, OS patching, sandbox/resource
   limits, egress restrictions and no production database credentials.
   The official Docker Compose manifest uses privileged containers, so treat
   its host as untrusted-code execution infrastructure, not a shared app server.
3. Choose the `language_id` that your **own instance** lists for the intended
   Java version using `GET /languages`. IDs differ between Judge0 editions and
   images: do not blindly use a hard-coded Java ID.
4. From the Supabase project's server-side secrets, configure:
   
   - `BYTEQUEST_JUDGE0_URL=https://your-protected-judge.example/api` (or the
     correct Judge0 API root; no trailing /submissions)
   - `BYTEQUEST_JUDGE0_KEY` (the API authentication token)
   - `BYTEQUEST_JAVA_LANGUAGE_ID` (the verified numeric Java language ID)
   
   Never put these values in `dist/`, GitHub Pages configuration, the browser,
   the repository, a URL query string or logs. In `index.ts`, the adapter
   is constructed from these existing environment variable names; no source
   changes or database migration are needed for initial activation.
5. Redeploy the existing `bytequest-firebase` Edge Function after providing
   the secrets. The judge adapter is considered ready only with an HTTPS URL and
   a positive numeric language ID. Before relying on hidden tests, verify the
   isolated host's access control and disable the optional external hidden-suite
   fallback with `BYTEQUEST_ALLOW_EXTERNAL_HIDDEN_JUDGE=false`. **Only make
   that switch after the trusted judge is tested**, because existing hidden
   submissions would otherwise fail closed.

## Execution behavior

- Submission creation uses `POST /submissions?base64_encoded=false` and a
  bounded 20-second poll of `GET /submissions/:token`, rather than
  `wait=true`. This avoids tying up a Judge0 web worker during compilation.
- Poll requests request only `status,time,memory`; stdout, stderr, compile
  diagnostics, hidden inputs and expected results are never relayed to learners.
- The complete suite is checked server-side. No client-provided result can earn
  points. On accepted runs the trusted judge reports runtime and peak memory.
- If the configured judge is offline or still processing after the deadline,
  ByteQuest returns a retryable infrastructure failure (503). No acceptance,
  streak or leaderboard points are recorded.
- All Java submissions still count toward the existing authenticated
  rate limits. Identical acceptance nonces remain idempotent.

## Verify before switching production traffic

1. Run `npm test` for the public/hidden routing, asynchronous polling, timeout
   and output-isolation regression tests.
2. Confirm your Judge0 host can compile the generated Java `Main` program and
   supports the submitted time/memory limits.
3. Submit **Lower Bound** (public tests) and **Palindrome Linked List** (public
   plus hidden). Both should use the trusted route. Test intentionally wrong
   answers, compile errors and unavailable-host errors.
4. Inspect redacted function logs for `bytequest_java_submission` with
   `backend: "trusted"` and an `elapsedMs` duration. No source code,
   inputs, tokens or user identifiers should be present.
5. Compare median and p95 submission time under equivalent load before and
   after activation. Dedicated compute does not guarantee any specific
   millisecond latency; benchmark the real host and tune its worker count.

## Rollback

To temporarily return public Java submissions to Wandbox, **remove or unset**
the trusted judge URL/language configuration and redeploy the function. For
hidden-case problems, the external fallback setting controls whether an
external provider may receive private tests; leave it disabled if private-suite
confidentiality is required and let hidden-case submissions fail closed until
the trusted judge is restored.

**Important:** A cheaper browser-only acceptance path is not a safe substitute
for a server-side judge. Do not download the hidden tests to Java Run.
