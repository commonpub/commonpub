# Session 247 — adversarial-audit fixes (pass 3, ROLLED)

An `ultracode` adversarial audit (Workflow: 7 diverse-lens finders over the full session-247 changeset →
3 refute-by-default skeptics per finding, majority-must-confirm → synthesis; 44 agents, 12 raw findings, 0
refuted, 9 distinct after dedup) confirmed the earlier fixes correct but surfaced same-class XSS sinks the
hardening missed AND regressions the hardening itself introduced. **Roll: server 2.121→2.122 / layer
0.115→0.116** (NO schema, NO migration). All 9 fixed:

1. **HIGH — federated hub-share `originUrl` stored XSS** (`inboxHandlers.ts:1468/1482` stored raw; the
   pass-2 `safeRemoteUrl` covered :822/:1060 but not this path). Guarded both, + `coverImageUrl`.
2. **HIGH — block views bind raw item url** (`BlockParts/Tool/DownloadsView` `:href="item.url"`). Guarded
   via the new shared `safeHref`.
3. **HIGH — legacy `javascript:`/`data:` in local scalar fields still render** (profile website+socialLinks,
   product purchase/datasheet, video url, hub website, event location/online). Write-guarded already, but no
   render guard + no migration for pre-guard rows → `safeHref` applied at every sink.
4. **MED — nav `href` regression:** pass-2's `httpUrl` (http(s)-only) rejected `mailto:`/`tel:`; the
   all-or-nothing nav PUT then 400s every save on a legacy contact item. Replaced with a dangerous-scheme
   denylist (allow http(s)/mailto/tel, block javascript:/data:/vbscript:/blob:/file:).
5. **MED — markdown import** didn't mirror the server's `help≤300`/`terms≤20000` caps → opaque PUT 400.
   Now an attributed advisory error at import.
6. **MED — `updateUserStatus` regression:** set `deletedAt` on delete but never cleared it → delete→active
   left `status='active'` with `deletedAt≠null`, invisible to username login. Now `deletedAt` = set on
   delete, else null.
7. **LOW — enumeration oracle:** the pass-1 status 403 fired BEFORE the password proxy (suspended=403 vs
   nonexistent/wrong-pw=401). Moved the status gate to AFTER Better-Auth verifies the password (revoking the
   just-minted session on a suspended hit); wrong password + nonexistent now both 401.
8. **LOW — SSO ban 500:** `createFederatedSession`'s suspend `throw` surfaced as a raw 500 (callers didn't
   catch). Mastodon + federated callbacks now catch → redirect to `/auth/login?error=account-suspended`.
9. **LOW — consent counted optional agreements:** a registrant declining an optional (`mustAccept:false`)
   agreement showed `1/2` partial. All 3 sites now filter to required agreements.

**Systemic:** the audit noted render guards were applied piecemeal to federated components only; introduced
`layers/base/utils/safeUrl.ts#safeHref` (auto-imported) as the one guard for all external stored-URL sinks.

## Verify
New tests: `safeUrl.test.ts` (safeHref), parser help/terms caps, admin reactivation clears `deletedAt`.
Gates: server 1776 · layer 5748 · reference typecheck 0. Browser: nav mailto/tel→200 + javascript/data→400;
active login→200, wrong/nonexistent→401 (no oracle, no 500); consent 2/2.

## Deferred (larger, out of this roll)
- One-off migration to null legacy stored URLs not matching `^https?://` (low value: writes already guarded,
  render now guarded, no known bad rows on these instances).
- CSP hardening — `security.ts:92` `script-src 'unsafe-inline'` is what makes `javascript:` hrefs executable;
  a nonce-based CSP would blunt this whole class.
- Block-content `url` fields are `z.unknown()` server-side — consider `httpUrl` validation on write too.
