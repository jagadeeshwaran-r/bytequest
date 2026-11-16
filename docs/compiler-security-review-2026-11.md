# ByteQuest compiler and security hardening review

**Review date:** 17 November 2026 (IST). **Scope:** repository security/logic checks, live Supabase security advisors, and automated simulated malicious-provider tests. This is **not** a penetration test or a production load test.

## Checked and verified

- Live Supabase **security advisor: zero findings** at review time. This does not prove absence of vulnerabilities. Performance advisor reported two missing covering indexes on `bytequest_live_events` foreign keys and an unused index on `bytequest_chat_messages`; no schema was changed as part of this compiler-focused review. [Database linter documentation](https://supabase.com/docs/guides/database/database-linter)
- Firebase ID tokens are verified for algorithm, certificate, issuer, audience, expiry, Google provider, and verified email. Private request ownership comes from verified identity, not caller-supplied `user_id`. The Edge Function has platform JWT verification disabled **because** it validates Firebase tokens inside its own handler; never remove or bypass that validation.
- Public compilation uses a fixed Wandbox endpoint, an allowlist of languages/versions, per-account rate limits, bounded timeouts and a 1 MB response cap. Retry attempts apply only to recognized transient sandbox capacity/HTTP failures; syntax/runtime errors are not retried. A transient compiler failure never records an accepted submission.
- Private Judge0 adapter uses server-defined HTTPS configuration, disabled outbound network, 2-second CPU and 5-second wall limits, 256 MB memory, no student-specified target URL and now **bounds provider JSON replies to 128 KiB**. Provider errors/malformed/internal statuses fail closed with a 503; they cannot be mistaken for the user's wrong answer. No private stdout/stderr/compilation diagnostics are returned.
- Judge0 verdicts distinguish accepted, wrong answer, time limit, compilation failure, and runtime error. Public compiler failures distinguish compilation and runtime diagnostics. The UI labels a timed-out private submission correctly.
- Regression tests exercise invalid/forged credentials, CORS, excessive payload sizes, signed or hidden-case leaks, erroneous sandbox status codes, oversized provider replies, and frontend credential scans. Existing JVM/native compiler and problem test suites remain enabled in CI.

## Residual risks / launch decisions

1. **External judge privacy:** The deployed function previously opted in to a Wandbox fallback for Java hidden suites when a private Judge0 instance is not configured. In that mode, public/hidden cases are sent from the server to the external provider with `save:false`. They are *not* exposed to the browser, but `save:false` is not a contractual guarantee that a third party never receives or retains them. The current hardening change disables third-party private-suite forwarding by default. To deliberately keep that fallback, set the server-only `BYTEQUEST_ALLOW_EXTERNAL_HIDDEN_JUDGE=true` and accept that hidden inputs go to Wandbox. Otherwise configure an isolated private judge, or hidden-test submissions fail closed with HTTP 503. See `DATABASE.md`.
2. **Host isolation:** ByteQuest does not host the external Wandbox sandbox, and therefore cannot independently guarantee its runtime isolation, capacity or network policy. For higher-trust competitions, use a dedicated, network-disabled worker with per-container resource quotas, output caps, concurrency limits and a managed queue.
3. **Anti-cheat:** Scores include self-reported practice progress, not independently verified competitive ranking. Code and harness running in the same process should not be treated as an adversarial contest-grade execution boundary.
4. **Abuse controls:** Per-account rate limits are present. Add ingress/provider-level IP anomaly monitoring and shared worker concurrency controls before a large public launch; CORS is *not* an anti-bot control.
5. **Incident response:** Set up compiler-error/5xx dashboards, service quota alerts, backup restoration drills, and a documented rollback procedure. No load/pentest claim can be made solely from these source tests.
6. **SQL performance:** Review the two missing foreign-key indexes separately using a database migration after a query-plan check; avoid unreviewed production schema changes.

## Release verification

1. Run `npm ci --ignore-scripts && npm run build && npm test`.
2. Confirm GitHub Pages CI deploys successfully.
3. Deploy **all** Edge Function source files together, retaining `entrypoint_path=index.ts`, `import_map_path=deno.json`, `verify_jwt=false` and existing environment secrets.
4. Verify the deployed function is ACTIVE, test its unauthenticated private request returns 401, and inspect logs for judge timeout/unavailable rates.
5. As a signed-in test account, run Java, Python, C and C++ valid and invalid code, then submit a known-correct solution, an invalid return type and a deliberate timeout. Check that outages do not credit points or expose private cases.
6. Run Supabase security advisors after material database changes, and periodically afterwards.

**No live malicious workloads or destructive security scans were run on production user data.**
