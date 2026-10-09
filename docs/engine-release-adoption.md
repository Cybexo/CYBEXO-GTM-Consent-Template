# Shared engine delivery

This is the local GTM recovery source candidate. It has not been published to the Gallery or adopted by a GTM container. The Web source, atomic shared release delivery, early TCF startup, GTM import and site qualification gates remain separate.

| Contract | Value |
| --- | --- |
| Engine loader and assets | `https://cmp.cybexo.com/loader.js`, `https://cmp.cybexo.com` |
| Engine contract | `1` |
| Installer and legacy installation platform | `gtm` |
| Host platform | `direct`, or `wordpress` when declared by the CYBEXO connector |
| Connector diagnostic | `gtm-v1.0.0` |
| Google owner | `native-gtm` when enabled; `none` when app configuration disables emission |

Every platform uses one engine build. The template has no release selector, pinned engine version or separate GTM engine catalogue. It passes the App ID, fixed configuration/assets endpoints, native owner and installer context to the common loader. Its injection permission allows only `https://cmp.cybexo.com/loader.js?*`. GTM's `injectScript` has no integrity argument; no loader SRI is claimed. Atomic release delivery, cache behavior and rollback must be verified for the shared Web release separately.

The historical descriptor and unchanged bootstrap bytes remain in `publisher/` for compatibility evidence. They do not select the current loader. The older `gtm-rename-*` scripts and their historical tracker documents are preserved; several expect source shapes already absent from the native-consent baseline and are not rewritten merely to pass.

## Context and ownership

Before defaults, the template reads CYBEXO's `cybexoCmpContextV1`, `cybexoCmpInstallationV1`, `__cybexoWpEngineInstaller` and frozen `__cybexoNativeGtmBootstrap` declarations. Conflicting App IDs, a competing installer/Google owner, unsupported Shopify or Drupal host, or conflicting WordPress host declarations stop startup before defaults, callback registration and network injection. No generic WordPress/Shopify/GTM global selects a platform. Legacy `gtm` means installer; WordPress remains a separate host.

Native `setDefaultConsentState` runs before registering the sole `cybexoGtmConsentUpdate` callback. With a matching early reservation, the template then calls `cybexoCmpResumeGtm(appId)` and skips injection only on `true`; failure denies without a second load. Without a reservation it injects the common loader as before. The explicit native owner plus legacy `data-consent-mode=off` suppress the direct page writer. App-level Google off may suppress later updates, but does not retract native defaults already established before asynchronous configuration. This integration therefore does not promise zero Google initialization.

Snapshot admission checks App ID, contract, legacy GTM installation identity and Google owner. New `installer`/`hostPlatform` fields must agree when present; older compatible contract-v1 snapshots without those added fields remain accepted. Engine release, engine version, build and adapter version are diagnostic values and never exact-build admission rules. The native callback uses the engine-calculated vector even during a pending transaction. Observation never becomes another consent writer.

A compatible WordPress platform connector may accompany this GTM installer. It must suppress its own engine load and Google commands. The engine identity retains `installationPlatform: gtm` while carrying `hostPlatform: wordpress` and `installer: gtm` separately. Already initialized competing engines are rejected before native defaults.

Download completion is not readiness. `callLater` coalesces observations and reads the latest snapshot through explicit `getSnapshot`/`subscribe` permissions. No Window timers, polling loop or invented acknowledgment is used. Missing API remains `ENGINE_NOT_AVAILABLE`; a later native callback retries observation. An app with Google disabled may remain diagnostically unavailable if its API appears only after the load observation and it emits no callback.

## Early TCF and qualification

The ordinary template path injects the loader after GTM starts. It cannot supply a TCF API to consumers that already ran outside GTM. The same public loader supports `data-gtm-bootstrap="on"` for an early synchronous reservation. Its App/host/installer/owner diagnostic is checked before native defaults. The loader's resume function rechecks current context and callback ownership, starts at most once and reports acceptance rather than readiness. No timers, separate customer bootstrap URL or long inline program are introduced. Local component cases cover waiting, delayed handoff, mismatch, duplicate and failure behavior; actual platform wiring and qualification are deferred. See [installation guidance](installation.md#tcf-page-setup).

## Source validation and promotion

Run the local sandbox and retained bootstrap checks:

```sh
node --test scripts/native-consent.test.mjs scripts/publisher-bootstrap.test.mjs scripts/engine-contract.test.mjs scripts/engine-release.test.mjs scripts/embedded-scenarios.test.mjs
```

Run the actual shared source integration against the reviewed Web checkout, using its existing dependencies without installing packages:

```sh
CYBEXO_WEB_SOURCE_ROOT=/absolute/path/to/reviewed/web/source node --test scripts/shared-engine-integration.test.mjs
```

The latter bundles the real loader in memory and executes it with the exact template sandbox source. It covers Direct and WordPress hosts, configuration delay, one native default, no direct Google writes, choice, cancel, saved restoration, withdrawal and duplicates. The build identifier is deliberately different from the historical pinned build. It skips explicitly without a source path. Local VM tests and the embedded-scenario harness do not substitute for actual GTM compilation/import, supported permission validation, Tag Assistant, platform-browser or delivery evidence.

Keep `metadata.yaml` unchanged until the reviewed template commit exists. Any later authorized promotion records that exact full source SHA in a subsequent metadata-only commit. Repository publication does not prove container adoption. Preserve historical immutable engine directories for retained installs; changing the common root remains part of the shared engine release gate, not an independent GTM release.
