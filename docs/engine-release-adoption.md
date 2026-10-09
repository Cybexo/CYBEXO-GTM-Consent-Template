# Immutable engine selection

This is the local WEI-04 GTM source candidate. It has not been published to the Gallery or adopted by a GTM container. The Web release's delivery and platform qualification gates remain separate from these source tests.

| Selection | Value |
| --- | --- |
| Engine release | `1.5.40-23fc15424d75` |
| Engine source | `65b35513` |
| Engine build | `production.20261009.031052.runlocal.65b35513` |
| Engine contract | `1` |
| Installation platform | `gtm` |
| Adapter identity | `gtm-v1.0.0` |
| Google owner | `native-gtm` when enabled; `none` when app-level emission is disabled |
| Loader | `https://cmp.cybexo.com/releases/1.5.40-23fc15424d75/loader.js` |
| Bootstrap | `https://cmp.cybexo.com/releases/1.5.40-23fc15424d75/tcf-bootstrap.js` |
| Assets | `https://cmp.cybexo.com/releases/1.5.40-23fc15424d75` |

The template passes the App ID, edge configuration URL, matching asset URL, developer ID, `data-consent-mode=off`, and all four release/contract/platform/adapter metadata fields as loader query parameters. Its injection permission is restricted to the selected loader. There is no editable runtime URL, mutable fallback, version selector, or automatic latest-release selection. Release changes require reviewed template source and a new published container selection.

The exact Web descriptor is retained as [publisher/engine-release.json](../publisher/engine-release.json). The paired inline bootstrap has unchanged bytes. GTM's documented `injectScript` API has no integrity or crossorigin argument, so the template does not claim loader SRI. The pinned path, provider byte-identity verification against the descriptor, and immutable release retention are the available delivery controls. The synchronous external bootstrap example carries SHA-384 SRI and anonymous CORS; an inline publisher bootstrap uses its exact bytes and the publisher's CSP nonce/hash. See [Google's custom-template API reference](https://developers.google.com/tag-platform/tag-manager/templates/api#injectscript).

## Observation and ownership

`copyFromWindow` reads the contract version and the shared adapter installer marker `cybexoCmpInstallationV1`. A shaped record `{appId, platform, release, googleOwner}` with a non-GTM platform and `direct` or `none` Google owner is rejected before native defaults, callback registration or loader injection. Direct, WordPress-direct, Shopify and Drupal installers claim it synchronously before their defaults, covering the interval before the public engine API exists. WP managed-GTM mode stays unmarked. Empty, false and malformed records do not claim an owner. An empty string App ID is permitted in the marker because excluded Drupal pages still establish denied defaults. This cooperative adapter marker does not alter the frozen engine contract. `callInWindow` calls only `getSnapshot` and `subscribe`. GTM forbids predefined Window timer keys, so the template has no timer permission, timer alias or polling loop. `callLater` coalesces lifecycle observations and re-reads the current snapshot when the callback executes. The template validates App, contract, release, engine version/build, platform, adapter version, and Google owner. It stores a diagnostic projection in its existing template storage owner; no persistence schema or receipt payload is introduced.

Engine download completion and readiness remain separate. One coalesced observation runs per loader completion, native callback or subscribed v1 event. Missing API is reported as `ENGINE_NOT_AVAILABLE` without self-scheduling; a later native callback can reattach to the current snapshot. An app with Google disabled may remain diagnostically unavailable when the API appears after load completion because it emits no native callback; this does not suppress platform choices or manufacture a Google update. `adapter-status` events do not trigger application. The template never claims a Google registration or reports acknowledgment: the core reserves that slot and invokes the existing native callback. Native transport failure has no direct `gtag` fallback. Google-off configuration can retain calculated platform signals without native choice updates; GTM defaults already ran before asynchronous configuration. This is not a promise of zero Google initialization.

The snapshot may be transaction-pending when the engine calls its native transport. The native callback therefore validates the selected identity and emission setting but uses the engine-supplied callback vector, preserving existing TCF, US and global policy. It does not replace that vector with a pending snapshot's null signals. The observer never becomes a second writer.

A compatible WordPress v1 adapter can register the `wordpress` kind on this GTM-installed engine. Its GTM installer option must suppress its own loader and direct Google commands, keep one synchronous bootstrap, and accept the `gtm`/`gtm-v1.0.0` identity. An already initialized Direct or WordPress engine is rejected by this template before native defaults or callback takeover. Concurrent startup conflicts are additionally governed by the Web engine's loader ownership checks. No additional Google writer may be registered by WordPress.

## Source validation and publication order

Run:

```sh
node --test scripts/native-consent.test.mjs scripts/publisher-bootstrap.test.mjs scripts/engine-contract.test.mjs scripts/engine-release.test.mjs
```

These tests execute the exact shipped template through a local VM with explicit GTM API mocks. They preserve the retained native/default/identity tests and add delayed readiness, latest-state observation, restore/cancel, regional vectors, Google off, identity mismatch, stale callback cancellation, duplicates, cross-installer ownership, and no invented acknowledgment. Bootstrap tests run the shipped JavaScript. They do not substitute for GTM sandbox compilation/import, Tag Assistant, Google delivery evidence, warm-cache migration, or the installed WordPress combination.

The older `gtm-rename-*` scripts and their historical tracker documents are preserved. Several expect variable names and extraction shapes already absent from the baseline native-consent template; they are not the current candidate verifier and must not be rewritten merely to pass.

Keep `metadata.yaml` unchanged until the reviewed code/template/bootstrap/descriptor commit exists. Record that exact full Git commit SHA in a subsequent metadata-only promotion commit with its release notes. Do not point Gallery metadata to its own commit, an uncommitted working tree, a guessed SHA, or the Web engine SHA. After the separate publication gate, verify the selected Gallery source SHA, import/compile and embedded tests, update the intended tag, preview, and publish the container only through the authorized rollout. Repository publication alone does not prove installation adoption.

The next release must preserve earlier immutable engine directories. The mutable compatibility root is not rewritten by this adapter migration. Its repair or retirement remains an explicit WEI-07 decision.
