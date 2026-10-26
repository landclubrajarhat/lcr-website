# LCR production release

## Separation and storage

Production website: existing Cloudflare Pages project `lcr-website`, branch `main`.
Expected default origin: `https://lcr-website.pages.dev` (use the actual project domain if different).
Production database: create a separate Cloudflare D1 database `lcr-members-production`.
Binding name: `LCR_DB`.

D1 stores members (including private mobile and source email), identities, salted password hashes, sessions, challenges, rate-limit counters, media image bytes, submissions and audit history. Password plaintext is never stored. Public endpoints show only approved profile fields and approved photos. Email/mobile stay private. NID is not imported. Source code is in GitHub; personal member records and original workbook are not.

The test project `lcr-website-test` keeps `lcr-members-test`. Do not reuse or copy its dummy members, password records or sessions into production.

## Before merging to main

In the existing production Pages project, configure framework None, build `npm run build`, output `public`, root blank. Verify the original project, not the test project. Keep `MEMBER_PORTAL_ENABLED=false` until database, Google admin and bindings are ready. Set `PAGES_WRANGLER_MAJOR_VERSION=4` and runtime flag `nodejs_compat`. Confirm the live domain from Deployments.

## Database initialization

Create `lcr-members-production` with the default data location unless a region is explicitly selected. D1 chooses the available placement; this does not promise storage in Bangladesh. Apply `migrations/production_schema.sql` to this fresh database. In the dashboard, run each full CREATE statement separately if needed, keeping trigger bodies intact. This initialization is idempotent; it is not an upgrade tool for unrelated or differently shaped tables.

Verify 9 application tables (including member_passwords), 5 triggers (review_revision_guard, publish_approved, audit_review, password_insert_revoke, password_update_revoke), and indexes, especially one_pending_per_member. D1 internal tables are additional.

Provision the approved admin identity privately using the agreed admin Gmail; keep that email out of public seed files. Do not provision public default passwords. Real directors can be imported as unpublished profiles using the existing private staging workflow; associate each authorized account with its confirmed Member ID. Stage and verify privately before importing, and do not copy test identities.

## Production settings

Use Production environment of lcr-website:

- LCR_DB: lcr-members-production
- APP_ORIGIN: actual production origin, no trailing slash
- GOOGLE_CLIENT_ID: existing approved web client ID, or a separate production client
- MEMBER_PASSWORD_ENABLED: true after schema initialization
- MEMBER_PORTAL_ENABLED: true only after admin provisioning and binding verification
- PAGES_WRANGLER_MAJOR_VERSION: 4
- Runtime: nodejs_compat

Add the exact production origin to the Google Web client's authorized JavaScript origins. Existing Google admin access remains required. Keep the testing audience until access requirements are reviewed; add the admin as an allowed test user. No Google client secret is used by this implementation.

Deploy main after these settings, check /api/config, login as admin, configure member passwords privately, and test one approved member's own-profile edit, submission and admin review. No real profile is public until consent and approval. Four-character passwords are accepted as expressly requested, but longer passwords are recommended for real accounts. Failed-login throttles remain enabled.

## Backups and recovery

D1 is managed by Cloudflare; repository commits do not back up member data. Use D1 Time Travel for the account plan's available recovery window and make an SQL export before imports or schema changes. Store exports privately, never in this public repository. For manual CLI exports use `wrangler d1 export lcr-members-production --remote --output <private-path>` in an authenticated local environment. No scheduled backup or private export is configured by this release.

For a portal incident, set MEMBER_PORTAL_ENABLED=false and redeploy; retain database contents. Cloudflare Pages can roll back the website deployment. Do not delete/reset the production database as part of a website rollback.

## Validation

17 automated tests pass, including member ownership, CSRF, approval integrity, password resets, minimum four-character policy, hashing and login limits. The scrypt module has passed workerd interoperability checks. User confirmed password creation/login working on the test site. Production migration, production login and real-data import require access to the Cloudflare production dashboard and must be verified separately.
