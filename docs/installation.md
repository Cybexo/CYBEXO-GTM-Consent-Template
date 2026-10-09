# Install CYBEXO CMP with Google Tag Manager

## TCF page setup

TCF consumers need the `__tcfapi` entry point before they run. For a TCF installation, copy the complete block from [publisher/tcf-bootstrap-inline.html](../publisher/tcf-bootstrap-inline.html) into the page `<head>`, before the GTM container snippet and any other TCF-dependent scripts. Keep this order on every page:

1. Synchronous TCF bootstrap.
2. Your normal GTM container snippet.
3. Scripts that depend on the TCF API.

Keep the bootstrap inline when you need it to be independent of a bootstrap network request. Apply your site's CSP nonce or exact script hash as appropriate. Do not use an asynchronous script, deferred script, module, dynamically injected script or a GTM Custom HTML tag for this early block.

Alternatively, host the exact [publisher/tcf-bootstrap.js](../publisher/tcf-bootstrap.js) file on your own site and reference it synchronously before GTM:

```html
<script src="/assets/tcf-bootstrap.js"></script>
<!-- Your normal Google Tag Manager container snippet follows. -->
```

Deploy the file before adding this reference. The selected CYBEXO URL is `https://cmp.cybexo.com/releases/1.5.40-23fc15424d75/tcf-bootstrap.js`; an external reference also depends on that request being allowed by the site's CSP and successfully delivered. For that cross-origin URL, use the exact published integrity value and anonymous CORS:

```html
<script src="https://cmp.cybexo.com/releases/1.5.40-23fc15424d75/tcf-bootstrap.js"
  integrity="sha384-XJ+QMWVaYoQHdg4EzFO01XDXyOMdzFWKn0c35kM/iN2lT7YE3MjU2LBA4Q2YvTLn"
  crossorigin="anonymous"></script>
```

Verify delivery on the actual site. The bootstrap and selected loader must be a qualified compatible pair; this repository records the tested bootstrap in [publisher/README.md](../publisher/README.md).

The bootstrap answers `ping` immediately, queues requests for the full API, and supports cross-frame requests. A locator iframe is created when the page body is available. If the CMP loader has not executed, queued listeners receive no invented TC data. When the CMP becomes ready in that same document, queued requests reach the full API. The bootstrap preserves an existing `__tcfapi` function and its queue; install only one CMP owner and do not layer CYBEXO over a different CMP.

For a configuration that does not use TCF, the early TCF block is not required. Google consent defaults and updates still belong to the GTM template.

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

This template sets native defaults and registers the native update callback before loading CYBEXO CMP. It loads `https://cmp.cybexo.com/releases/1.5.40-23fc15424d75/loader.js` with `data-consent-mode=off`, which disables the loader's separate `gtag` command path. The template's native bridge remains responsible for publishing validated choices to GTM. This flag does not mean that Google consent is disabled for this integration. Keep Consent Mode enabled in the app's dashboard configuration: the template does not override an app-level disabled setting.

Web CMP 1.5.38 and later also expose `enableAdvertiserConsentMode: false` while the native GTM bridge is present, so automatic TCF inference cannot overwrite the bridge's saved values when the settings dialog opens. The standard TCF API, disclosures and lifecycle events remain available. Do not separately set `window.gtag_enable_tcf_support = true` on these pages; that would explicitly introduce a second Google consent writer. Direct Web installations retain their own inference configuration.

After saving consent, reopen settings, change a switch without saving, and close the dialog. Check that all four Google values and the saved choice remain unchanged. Then save a deliberate change and verify that its corresponding values update.

Do not install the direct Web consent-default snippet alongside the GTM template. It would introduce another consent owner. If you migrate from a direct installation, remove the old consent commands and direct loader while retaining the synchronous TCF block when TCF is used.

If the loader fails or conflicting Settings IDs/consent callbacks are detected, the template reports failure and keeps consent denied. Correct the configuration or delivery problem and reload the page. Firing the failed tag again in the same document does not restore permission.

A compatible WordPress v1 platform adapter may run on the same page with its installer set to GTM. It must suppress the WordPress loader and direct Google commands, preserve one early TCF bootstrap, and accept this template's `gtm` installation identity. WordPress platform consent and the native Google transport have separate owners. Do not enable both engine installers.

The template reads v1 snapshots only to observe the selected engine. It never infers consent from a download, emits a second update from a subscription, or reports platform acknowledgment. Its initial readiness observation retries for at most six seconds; if the API is still unavailable, the observation is marked unavailable. A later legitimate native callback attempts observation again. App-level Google emission off suppresses native choice updates, but does not retract GTM defaults already established before configuration arrived. Keep Consent Mode enabled for this integration; use the appropriate non-Google installation when no Google initialization is wanted.

## Verify before publishing

- In Tag Assistant, confirm four denied defaults before Google initialization and the expected developer ID.
- Accept, reject and change purpose-specific/Analytics choices; confirm the current native consent values after each action and after reload.
- Verify delivery for permitted Google events and the intended behavior of tags after withdrawal.
- Test blocked loader/configuration/GVL delivery. A script-load success in GTM does not mean the CMP finished loading, and a timer is not a readiness check.
- For TCF, confirm synchronous stub ping before loader execution and same-document listener delivery after recovery. Check repeated iframe listener responses and listener removal where those integrations are used.
- Confirm one loader and one consent owner when the tag executes repeatedly.

Gallery updates are offered to existing workspaces for review. Review and accept the intended template update, test the workspace, then publish the container. A repository update does not update an already-published customer container automatically.

## References

- [Google consent-template implementation](https://developers.google.com/tag-platform/tag-manager/templates/consent-apis)
- [GTM Consent Initialization and tag consent settings](https://support.google.com/tagmanager/answer/10718549?hl=en)
- [IAB CMP API and synchronous stub requirements](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md#requirements-for-the-cmp-stub-api-script)
- [Gallery update process](https://developers.google.com/tag-platform/tag-manager/templates/gallery#update_your_template)

These installation instructions do not establish Google or IAB certification of a release.
