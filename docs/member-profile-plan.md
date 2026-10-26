# Member profile prototype — Phase 1
Status: proposed design, dummy data only. No production authentication or backend.

## Field dictionary
| Field | Editable by member | Public after approval |
| --- | --- | --- |
| Member ID | No | Yes |
| Full name | Yes, required, 80 chars | Yes |
| Profession | Yes, required, 80 chars | Yes |
| Designation | Yes, 80 chars | Yes |
| Organization | Yes, 120 chars | Yes |
| Bio | Yes, 500 chars | Yes |
| Photo | Yes, JPEG/PNG/WebP, max 2 MB | Yes, only with explicit publication approval |
| Email | No; future server-verified Google identity | No |
| Mobile | Yes, optional Bangladesh mobile format | No |
| NID | Not collected | Never |

These fields and publication rules remain proposed until owner approval.

## Production permission matrix
| Action | Visitor | Member | Admin |
| --- | --- | --- | --- |
| View approved public profile | Yes | Yes | Yes |
| Read private contact data | No | Own only | Only explicitly authorized admin |
| Edit profile / photo | No | Own only | Administrative workflow to be specified |
| Change member identity binding | No | No | Controlled, audited admin operation |
| Submit correction | No | Own only | No |
| Approve / return submission | No | No | Yes |
| Export private master | No | No | Explicit export permission |

Never trust browser role selection, submitted Member ID or email. The demo selector is NOT authentication. A production backend must verify Google tokens and membership bindings and authorize every request.

## State transitions
Approved -> submitted pending -> approved OR returned for correction -> submitted pending.
Pending data never changes the published record. Return requires a reason.
Approval must publish an explicit allowlist of public fields; private data must never reach public responses.
Store immutable revisions and reviewer/time in production. Export approved master only, with revision ID and formula-injection protection.

## Prototype scope
Open profile-demo.html. 20 synthetic profiles; only M001/M002 are selectable member personas.
Session memory only, reset on reload; no localStorage, API, Google login, durable upload or export.
All source data is dummy and inspectable in this public repository.
Photo object URLs remain in the current tab. Real data/images must not be used.
Existing homepage behavior remains intact; a link opens this separate prototype.

## Next phases and acceptance
1. Owner reviews field dictionary, publication consent and permissions.
2. Verify free-tier limits and choose backend/auth/database/private media storage. No paid service or production deployment without approval.
3. Implement server-verified Google login and pre-approved membership mapping.
4. Implement versioned submissions, admin review and public projection.
5. Add approved-only Google Sheets/Excel export, retry/reconciliation and audit history.
6. Verify unauthenticated denial, cross-member denial, invalid token denial, private-field exclusion, upload validation, concurrent/stale review handling, mobile and keyboard accessibility.
7. Use a feature branch and PR targeting development. Main merge and production deployment require explicit approval.

## Review checklist
- Guest sees all 20 public profiles, never email/mobile.
- M001 sees own prefilled form; Member ID/email are read-only.
- Submit leaves public profile unchanged; pending form is locked.
- Admin compares old/new fields and photo, then approves or returns with reason.
- Returning preserves the draft; resubmission works.
- Approval updates only approved public fields in directory/detail.
- Invalid or oversized images are rejected; reset restores seed data.
- Text is rendered through textContent (no user HTML).
- Refresh clears all demo edits.

## Director workbook import contract
Use the owner-supplied Director workbook as the initial private source. Keep the workbook and extracted records/photos out of this public repository.
Map Member ID -> immutable member ID; Name -> fullName; Mobile -> private mobile; Email Address -> private identity contact pending Google verification; Profession -> profession; embedded Image -> pending private photo asset.
Do not import NID into this profile feature, export or browser payload. Match embedded photos to their anchored worksheet row and then Member ID; never match by image order. Preserve source blanks as blank; do not invent names, contact information or professions. New designation, organization and bio fields start empty unless supplied by the member.
The current workbook contains 20 unique Member IDs. Initial records must be staged privately, reconciled and reviewed before publication. A populated email is not proof of ownership. Missing Google identities require controlled enrollment and admin-approved Member ID binding before self-edit access. Original source values must remain traceable; later edits are versioned submissions, not destructive overwrites of the source workbook.
Real member data is NOT loaded by this browser-only prototype. Backend implementation and explicit publication approval remain prerequisites.
