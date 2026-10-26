# Member portal backend — draft implementation

This branch stacks on the dummy prototype PR. Nothing has been deployed. No real member data, identity addresses, NID or photos belong in Git.

## Architecture and publication
Cloudflare Pages serves allowlisted static assets; Pages Functions handles /api/*; D1 stores private roster records, Google subject bindings, hashed sessions, revisions, review history and bounded photo BLOBs. Photos are capped at 200 KB each and eight retained uploads per member in this phase. No R2 account or paid service is required by this code. Free-plan limits must be verified on the owner's account before activation; quota errors fail closed, never upgrade/fallback automatically.

Imported members default to unpublished. Submitted corrections do not change the approved record. Admin approval is a guarded SQL UPDATE; database triggers enforce the original revision, publish the new fields and write the review audit event atomically. Return preserves the draft and requires a reason. Public responses select an explicit allowlist; contacts and Google identity records are never included. Non-published photos require owner/admin session access.

## Configuration required before any preview activation
1. Review the PR and proposed fields/permissions. Main merge and production deployment need explicit approval.
2. Create a dedicated **preview-only** D1 database on Workers Free; do not bind a preview to production/private data. Apply migrations/0001_member_portal.sql only to that empty preview database. No automatic migration runs on deployment.
3. Bind it as LCR_DB in the Pages **Preview** environment. Keep the production environment unconfigured/disabled.
4. Create a Google Identity Services Web OAuth client. Register the exact approved HTTPS preview origin in Authorized JavaScript origins. Its client ID is public configuration, not a client secret; this token-based flow does not require a client secret.
5. Configure APP_ORIGIN (exact HTTPS origin, no trailing slash), GOOGLE_CLIENT_ID, MEMBER_PORTAL_ENABLED=true **only in preview** after setup. Otherwise API returns 503. A mismatched host is rejected, including arbitrary preview URLs.
6. Install dependencies with npm ci; run npm test and npm run build. Pages build command: npm run build; output directory: public. Keep functions/ at repository root. Never set repository root as the static output.
7. Add synthetic members and a pre-approved Google identity privately for integration testing; no real workbook import until separately approved. Admin provisioning requires an approved identity with role=admin in the private database. There is no public self-registration or role-selection API.
8. Test actual Google login, cookies, own-only access, unpublished media, approval, return, stale revisions and mobile browser layout on the dedicated preview. This PR is not production-ready until those runtime checks pass.

## Identity and sessions
Google token signatures/issuer/audience/expiry/iat/nonce are verified through jose and Google's rotating JWKS. Login uses a five-minute one-use nonce cookie. First login may bind an admin-preapproved email only when Google is authoritative (Gmail or verified Workspace). Other account types require a previously approved Google subject binding. Never grant access based on a typed email, mobile, NID, name or row number. Use sub for subsequent account identity, not mutable email. Authenticated requests re-read active role/membership; deactivation takes effect immediately. HttpOnly Secure SameSite=Strict cookies contain random tokens; only SHA-256 token digests are stored. Sessions expire after one hour. Mutations require exact Origin and a session CSRF token. Request-body limits, image signature checks and per-identity/login rate limits are enforced. Private identity data is not logged.

## Private workbook staging
Run scripts/stage-directors.py with an explicit workbook path and an ignored .local/ output directory. It generates unpublished member INSERT statements and row-anchored private photo assets/SQL. It never sends anything to Cloudflare. Inspect only in a private workspace; never upload these outputs to GitHub or a static directory. NID is excluded. Existing nonblank email values are stored as member contact source only; they are **not** automatically trusted for login. Use a separate controlled enrollment to approve email/subject mappings after member verification. Missing fields stay blank. IDs cannot be edited by members. Import fails on duplicate IDs or photo row ambiguity; it must not overwrite existing records.

## Not included in this phase
Cloud account provisioning, automatic production rollout, Google Sheets/Excel export/sync, administrator identity-management UI, upload garbage collection and independent security review. Admins can review private mobile fields; granting that role requires owner approval. Returned and approved revisions retain private contact history: define retention/deletion policy before real-data use.

## References
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
