# Member ID + Password (test rollout)

Members can use their Member ID without signing into Google. Existing profile ownership, consent, pending review and approval remain in place. Admin currently continues using Google; this avoids issuing an admin password through a public setup endpoint.

## Apply to lcr-website-test only

1. Keep `MEMBER_PASSWORD_ENABLED=false` or unset while preparing.
2. Apply `migrations/0002_member_passwords.sql` once to `lcr-members-test`. The dashboard may require running CREATE TABLE and the two complete CREATE TRIGGER statements separately. Never split a trigger body at its internal semicolon. Verify all three objects exist, including `password_insert_revoke` and `password_update_revoke`.
3. Test project runtime needs `nodejs_compat` (explicitly enable it for the build/runtime). The password module uses native `node:crypto` scrypt (N=16384, r=8, p=5, maxmem=32 MiB), unique 32-byte salt and 32-byte hash. Do not reduce the work factor to work around a runtime error. Static output remains `public`, build `npm run build`.
4. Deploy the password branch to the test project only after review. Keep `APP_ORIGIN=https://lcr-website-test.pages.dev`, existing `LCR_DB`, Google configuration and `MEMBER_PORTAL_ENABLED=true`. Set `MEMBER_PASSWORD_ENABLED=true` after migration. Main is not part of this change.
5. Sign in as the existing Google admin. Under Admin Review, use the member password controls to create the dummy member's temporary password. The account must already be an active member identity with a member record. No self-enrollment or arbitrary role changes are exposed.
6. Type and confirm a temporary password in the admin form. Share it only with that member using a private channel. It is cleared from the form after saving, is not returned by the API, expires in 24 hours, and is never logged or stored as plaintext. Do not put it in GitHub, screenshots, or this setup file.
7. Log out. Enter `LCR-TEST-001` and its temporary password. Before accessing the profile or media, the member must replace it with a different 4–128-character password. All earlier sessions are revoked. Sign in again with the new password.
8. Test own prefill/edit/photo/consent -> pending -> admin return -> resubmit -> approve. Confirm another member and anonymous visitors cannot see private details. Reset again and verify the previous password and sessions fail.

## Controls and limitations

- HTTPS-only HttpOnly session cookies, Origin validation and CSRF checks remain required. Password login has no cross-site login route.
- IP limit: 20 password attempts / 15-minute bucket. Member-ID limit: 8 attempts / 15-minute bucket. Failures use one generic message. Buckets count successful attempts too. Wait for the next bucket if throttled. Admin reset and password change have separate limits.
- Admin resets are explicit, audited, target active member identities only, accept admin-selected temporary passwords, and revoke all sessions through database triggers. Confirm the recipient through the club's established process before sending a reset password.
- Password hash updates use compare-and-swap. Session insertion checks the current credential hash so a concurrent reset cannot revive an old password.
- No password reset email service, public registration, public default passwords, or real-director import is included.
- Google is optional for member login. It remains available for the existing admin and any previously enrolled accounts. Members with a temporary password must change it even if they use Google.
- Do not disable Google admin access without arranging and testing a separate admin recovery mechanism.
- Disable `MEMBER_PASSWORD_ENABLED` to roll back password routes; do not drop data tables. Google login remains usable. All auth changes must receive hosted testing before club-wide use.

## Verification performed

17 Node tests pass with real SQLite and native password hashing. Static allowlist build and Pages Functions bundle pass with `nodejs_compat`. A separate local workerd/Miniflare smoke check successfully derives a 600,000-iteration key using native node:crypto. Wrangler dev's ordinary server startup hit an environment network-interface error; Miniflare bypassed that launcher problem. Hosted CPU budget, browser layout and deployed end-to-end workflow still require verification; local emulation cannot establish hosted limits.

## Hosted hashing correction

Hosted reset reported RESET_HASH_FAILED even after selecting Wrangler 4. New password hashes use native scrypt with OWASP's 16 MiB profile rather than relying on high-iteration PBKDF2. Existing PBKDF2 records are recognized for compatibility; if that runtime rejects legacy verification, admin must issue a new scrypt temporary password. The exact previous runtime exception was not exposed, so an iteration limit is a hypothesis, not an established root cause. There is no migration of member or identity data. Native hashes are encoded from bytes rather than assuming Buffer.toString(hex). Hosted reset/change/login must still be checked.

The corrected bundled password module passed a workerd/Miniflare smoke test for scrypt generation, correct and wrong password verification, and byte-for-byte interoperability with Node scrypt. Node tests also cover legacy verification and rejection of tampered work factors.

## Admin-selected passwords

The admin now types and confirms each member temporary password. There is no random fallback and no plaintext password in the response. Minimum length is four characters (digits accepted), maximum 128. This follows the owner's explicit request; four-digit passwords have only 10,000 combinations and should be restricted to dummy testing. The existing throttles, hashing, 24-hour temporary expiry and mandatory first-login change remain. Admin should enter a longer password for real accounts. Updated test total: 17.
