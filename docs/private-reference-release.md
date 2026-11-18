# ByteQuest - protected Java reference release

## Policy
References are server-only. Reference-read requires a valid Firebase token, a verified accepted submission for the same problem revision, or the problem author/library admin. Browser practice alone is insufficient.

## Coordinated release order (critical)
1. Take full backups of bytequest_problems, bytequest_problem_history, bytequest_problem_private, progress and submissions.
2. Execute database/private-reference-prepare.sql. This creates a service-role-only table and copies reference solutions. Verify private reference row count equals all problem count. Public rows remain unchanged at this stage.
3. Merge PR #65 and deploy its updated GitHub Pages site. Deploy the matching Edge Function source under supabase/functions/bytequest-firebase as version with verify_jwt=false, preserving Firebase token validation and secrets.
4. Test that authors can reopen their references in Studio, and that reference-read returns 403 to unverified accounts and 200 to current-revision verified acceptances. Do NOT proceed if these fail.
5. Apply database/private-reference-solutions.sql to atomically remove all references from public problems and history, and change the authoring RPC to store private references.
6. Verify no public row or history has a reference, private row counts/revisions match, guest catalog loads 32 problems, Studio can edit and publish, previously solved problems/drafts/streaks remain unchanged.

## Read-only verification SQL
select count(*) from public.bytequest_problems;
select count(*) from public.bytequest_problem_references;
select count(*) from public.bytequest_problems where content ? 'reference'; -- must be zero
select count(*) from public.bytequest_problem_history where content ? 'reference'; -- must be zero
select count(*) from public.bytequest_problems p left join public.bytequest_problem_references r on r.problem_id=p.id where r.problem_id is null or p.revision<>r.revision; -- must be zero

## Required manual security checks
- Public anonymous PostgREST read must have no content.reference in any published problem.
- The published dist/problems.js bundle must contain no reference or algorithm solution body.
- Invalid or missing Firebase token must get HTTP 401, unverified account gets 403, stale revision gets 409.
- A verified accepted submission for this problem and current revision can read its reference. Another problem or another account cannot.
- Browser-only practice does not unlock the reference. Test both desktop and mobile.
- Verify Studio loads references for authored problems and does not re-publish references in public catalog after correction.

## Risk disclosures
- GitHub is PUBLIC. Previously committed answers and the new test-only fixture can still be read from this repository and old Git history. This fix removes code from deployed public assets and public database rows, but does NOT make historical sources secret. Move test fixtures into a private CI source and address repository visibility/history for genuine confidentiality.
- The deployed Edge Function and GitHub backend source currently differ; deploying GitHub also changes the external hidden-judge fallback default from enabled to fail-closed, which can make hidden-test submissions unavailable until a trusted judge is configured.
- Merging GitHub does not update Supabase SQL or Edge Functions. The vulnerability remains until ALL release steps finish.
- Do not change or delete user progress or verified submission records in this migration.