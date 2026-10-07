# User accounts and data isolation

7 October 2026 · user-confirmed future requirements; not implemented or scheduled

## Required outcome

The product must provide user accounts and isolate each user's private
campaign data. Accounts and data isolation are required product scope, not optional
hosting enhancements. Complete implementation and verification before exposing
campaign data through public or multi-user hosted access.

Authentication establishes the signed-in identity. Authorization determines which
campaigns and resources that identity may access. A successful login alone does
not provide data isolation. The current local development application remains
without login until this feature is implemented. Accounts can be developed and
tested locally without AWS; this plan does not authorize adding them during
unrelated features or deploying publicly.

## Account workflow and open choices

Provide an explicit sign-in/sign-out workflow and clear recovery for expired or
invalid sessions. Decide account provisioning, identity provider, sign-in method
and account recovery before implementation. No provider, credential scheme or
AWS identity service is selected by this plan.

Campaign ownership is explicit. Default access is to the user's own campaigns;
another account cannot access them merely by knowing a URL or resource ID. Sharing,
co-GM roles, player access, invitations and collaboration require separate product
decisions and are not implied by having multiple accounts.

## Isolation boundary

Apply server-side authorization to every read and write path, including campaign
listing/creation, documents, search snippets, folders/order, maps/markers/assets,
party profiles, sessions/pins, game state, history and operation receipts. URLs,
IDs, request payloads and client-provided owner fields do not establish access.
Derive the acting identity from trusted authentication at the server boundary.

Scope persistence access to the authorized campaign owner and validate referenced
resources within that same campaign. Define query scoping and database integrity
constraints together; the UI's campaign picker is not an access control. Reject
cross-owner reads and changes without leaking document titles, search results or
other private content through responses or errors.

Asset delivery and future private module authoring need explicit ownership and
access rules too. A reusable module distribution may be shared only under its
defined access policy; private campaign copies and user-authored module sources
must not become shared because they derive from the same module.

Browser caches, drafts, pending requests and workspace state must be scoped to
the authenticated identity and campaign. Sign-out or switching accounts must not
show the previous account's data or replay its writes as the new account. Define
recoverable draft behavior on expiry/sign-out without bypassing authorization.

## Architecture and delivery sequence

Define future ownership alongside multiple-campaign design, including attribution
of the existing local campaign when adopting accounts. Decide the model before
production implementation; do not reset data or silently assign ownership based
on untrusted client input. Identity and authorization belong to the host/API and
generic engine boundaries, not concrete adventure modules or neutral UI controls.

Implement and verify accounts and isolation as a separate product slice after
multiple campaigns, using local development and isolated tests. There is no AWS
dependency. The ownership model belongs in campaign design before this slice,
rather than being postponed to deployment.

Before hosted exposure, verify the implemented account/isolation boundary together
with transport/origin protection and hosted database access restrictions. This
release gate applies even if later features such as chronicle or custom tools are
incomplete. Ordinary unrelated local updates do not need to implement accounts.
Production backups and recovery remain separate deployment work under the data
policy.

## Planned acceptance

- Two accounts own independent campaigns and can access only their authorized
  data across every read/write endpoint, including direct resource URLs and assets.
- Supplying another user's campaign/material IDs or cross-campaign references
  fails without returning private content or changing either campaign.
- Missing, expired and invalid authentication have deliberate localized recovery;
  rejected writes do not report success or discard recoverable drafts.
- Switching accounts does not expose earlier cached content or replay pending
  writes under the wrong identity.
- Search, receipts, concurrent writes and future module updates obey the same
  ownership boundary. Legitimate owner saves retain revisions and transactions.
- Integration tests verify actual API authorization and persistence scoping with
  separate identities, not only hidden UI controls.

These are future acceptance criteria, not successful test evidence. Related:
[recommended sequence](15-Near-term-improvements.md#recommended-development-order),
[AWS/data policy](21-Development-data-and-AWS-protection.md),
[architecture](06-Module-architecture.md).
