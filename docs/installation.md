# Install CYBEXO CMP with Google Tag Manager

## TCF page setup

This source is qualified in the dedicated test container; public Gallery promotion is pending. The ordinary template establishes native Google defaults before injecting the single public `https://cmp.cybexo.com/loader.js`; the loader installs the TCF stub when it executes. Consumers that run earlier need the same loader to execute synchronously before them and before the GTM container:

```html
<script id="cybexo-cmp" data-settings-id="YOUR_CYB_APP_ID"
  data-gtm-bootstrap="on" src="https://cmp.cybexo.com/loader.js?data-gtm-bootstrap=on"></script>
```

Keep the stable startup query in the script URL. It selects the native GTM startup contract and avoids old browser cache entries for the bare loader URL, which were historically served with a 31-day lifetime. This is the same shared file and build; the query is not a release number and must not change per release. Current responses revalidate on subsequent page loads.

Use the actual App ID from the dashboard, matching the template tag. Keep this script synchronous: no `async`, `defer` or `type="module"`; allow it under the site's CSP. The `on` opt-in reserves the native GTM installer/owner and exposes TCF immediately. It starts no configuration, banner or Google command until the template establishes native defaults, registers its callback and resumes the same loader. The template then skips another injection. No separate bootstrap URL, engine version, hash or inline program is required.

Consent Initialization orders GTM tags, not scripts that ran before GTM. Keep Google tags after the native defaults established by the template. The early TCF stub provides no consent grants and does not replace Basic-mode tag blocking. A blocked loader cannot expose the early API; a blocked GTM leaves the loader waiting without a banner or grants.

For WordPress configured to use GTM, let the compatible plugin manage its own early bootstrap and host declaration; do not add a competing manual installer. Only `data-gtm-bootstrap="on"` is supported when the attribute is present and nonempty; a typo fails instead of falling back to Direct ownership. The files in `publisher/` retain historical bootstrap evidence and are not the new customer installation program.

The shared 1.5.42 artifact, dedicated-container publication, Google sandbox tests and live browser ordering passed the [October 9 qualification](qualification-2026-10-09.md). This does not qualify every customer container or a public Gallery revision. WordPress wiring is a separate milestone.

## Template fields

| Field | Configuration |
| --- | --- |
| CYB App ID | Copy the actual `CYB-` Web App ID from the dashboard, where it may be labeled Settings ID. This template release rejects legacy IDs and keeps consent denied. Do not paste a URL or add query parameters. |
| Global defaults JSON | Set each of the four Google keys to `granted` or `denied`. Omitted or invalid values remain denied; malformed JSON denies all four. Defaults do not record a visitor choice. |
| Region list | Optional comma-separated country or subdivision codes, such as `DE, FR, US-CA`. Use valid ISO region codes. |
| Region defaults JSON | Optional overrides for the listed regions. Omitted keys or blank optional JSON inherit the global defaults. Explicit invalid values deny that key; malformed nonblank JSON denies all four. A more specific region takes precedence. |
| Wait for update | Milliseconds allowed for asynchronous restoration: 500–10,000 inclusive. Invalid or out-of-range values use 500. Choose a value suited to the site's delivery and test it. |

Denied global defaults:

```json
{"ad_storage":"denied","analytics_storage":"denied","ad_user_data":"denied","ad_personalization":"denied"}
```

Configure the tag to fire on **Consent Initialization – All Pages**. GTM's built-in consent checks and any additional checks on other tags determine how those tags behave. A denied Consent Mode state is not a universal network blocker: configure and test Basic blocking separately when that is the desired installation. Native consent updates and tag blocking are separate controls.

## Migrating an existing installation

Migrate a legacy App ID before updating to this template release. Complete a supported migration that preserves the app configuration and consent history, then copy the actual `CYB-` App ID from the dashboard. Do not substitute a new prefix yourself; a renamed string does not identify a migrated app. Verify the migrated app, enter its actual ID in the tag, and test the workspace before publishing. Contact CYBEXO support if the migration is not available for your app.

## Consent ownership

This template sets native defaults and registers the native update callback before loading CYBEXO CMP. It loads `https://cmp.cybexo.com/loader.js` with `data-consent-mode=off`, which disables the loader's separate `gtag` command path. The template's native bridge remains responsible for publishing validated choices to GTM. This flag does not mean that Google consent is disabled for this integration. Keep Consent Mode enabled in the app's dashboard configuration: the template does not override an app-level disabled setting.

Web CMP 1.5.38 and later also expose `enableAdvertiserConsentMode: false` while the native GTM bridge is present, so automatic TCF inference cannot overwrite the bridge's saved values when the settings dialog opens. The standard TCF API, disclosures and lifecycle events remain available. Do not separately set `window.gtag_enable_tcf_support = true` on these pages; that would explicitly introduce a second Google consent writer. Direct Web installations retain their own inference configuration.

After saving consent, reopen settings, change a switch without saving, and close the dialog. Check that all four Google values and the saved choice remain unchanged. Then save a deliberate change and verify that its corresponding values update.

Do not install the direct Web consent-default snippet alongside the GTM template. It would introduce another consent owner. If you migrate from a direct installation, remove the old consent commands and direct loader and qualify the shared-loader early TCF path when TCF consumers execute before GTM.

If the loader fails or conflicting Settings IDs/consent callbacks are detected, the template reports failure and keeps consent denied. Correct the configuration or delivery problem and reload the page. Firing the failed tag again in the same document does not restore permission.

A compatible WordPress v1 platform adapter may run on the same page with its installer set to GTM. It must suppress the WordPress loader and direct Google commands, preserve its early TCF machinery, and accept this template's `gtm` installation identity. The template reads the CYBEXO WordPress installer marker and supplies the separate `wordpress` host context to the shared engine. WordPress platform consent and the native Google transport have separate owners. Do not enable both engine installers.

The template reads v1 snapshots only to observe the shared engine. It never infers consent from a download, emits a second update from a subscription, or reports platform acknowledgment. Each loader completion, native callback or subscribed v1 event queues at most one asynchronous observation through GTM callLater. There is no timer polling. If the API is unavailable at that point, the diagnostic is ENGINE_NOT_AVAILABLE; a later native callback attempts observation again. With Google disabled and no native callback, a late API may remain diagnostically unavailable although the engine itself is ready. App-level Google emission off suppresses native choice updates, but does not retract GTM defaults already established before configuration arrived. Keep Consent Mode enabled for this integration; use the appropriate non-Google installation when no Google initialization is wanted.

## Verify before publishing

- In Tag Assistant, confirm four denied defaults before Google initialization and the expected developer ID.
- Accept, reject and change purpose-specific/Analytics choices; confirm the current native consent values after each action and after reload.
- Verify delivery for permitted Google events and the intended behavior of tags after withdrawal.
- Test blocked loader/configuration/GVL delivery. A script-load success in GTM does not mean the CMP finished loading, and a timer is not a readiness check.
- For TCF, confirm synchronous stub ping after the early loader executes and before GTM or other TCF consumers execute and same-document listener delivery after recovery. Check repeated iframe listener responses and listener removal where those integrations are used.
- Confirm one loader and one consent owner when the tag executes repeatedly.

Gallery updates are offered to existing workspaces for review. Review and accept the intended template update, test the workspace, then publish the container. A repository update does not update an already-published customer container automatically.

## References

- [Google consent-template implementation](https://developers.google.com/tag-platform/tag-manager/templates/consent-apis)
- [GTM Consent Initialization and tag consent settings](https://support.google.com/tagmanager/answer/10718549?hl=en)
- [IAB CMP API and synchronous stub requirements](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md#requirements-for-the-cmp-stub-api-script)
- [Gallery update process](https://developers.google.com/tag-platform/tag-manager/templates/gallery#update_your_template)

These installation instructions do not establish Google or IAB certification of a release.
