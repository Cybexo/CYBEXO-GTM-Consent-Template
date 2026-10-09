# CYBEXO GTM Consent Template

This is an unpublished shared-engine recovery candidate. Import, site qualification and Gallery/container promotion remain separate gates.

Install CYBEXO CMP through the Google Tag Manager Community Template Gallery. The template sets Google Consent Mode defaults and updates the four Google consent values when a visitor makes or changes a choice.

## Install

1. Copy your **CYB App ID** (shown as Settings ID in the dashboard) from the CYBEXO dashboard and keep **Consent Mode enabled** for that app.
2. Check the [early TCF startup requirement](docs/installation.md#tcf-page-setup) before adopting this candidate on a TCF site.
3. In GTM, open **Templates → Search Gallery**, find **Cybexo CMP**, and add the template. Create a tag using it and enter your **CYB App ID**.
4. Keep the denied global defaults unless your consent configuration requires a different setting. Regional overrides are optional. See [field and region guidance](docs/installation.md#template-fields).
5. Select **Consent Initialization – All Pages** as the tag's trigger.
6. Check fresh visits, saved choices, acceptance, mixed choices and withdrawal in Tag Assistant before publishing the container. Confirm that the template version in your workspace is the version you intend to publish.

A GTM-only installation cannot expose TCF before GTM and its injected loader execute. The early native reservation uses that same public loader with `data-gtm-bootstrap="on"`. Its local component contract is implemented; delivery, GTM compilation and site qualification remain required before publication.

Use one CYBEXO consent installation per page. Do not add a second direct CMP loader or a separate `gtag('consent', ...)` setup alongside this template. See [complete installation and verification guidance](docs/installation.md).

The native GTM bridge is the single Google Consent Mode writer. The current CMP runtime disables automatic Google TCF inference for this integration while preserving the TCF API and disclosures. Remove any separate `window.gtag_enable_tcf_support = true` setting from a native GTM installation. When testing saved choices, also reopen settings and cancel an unsaved edit: Google consent values must remain unchanged.

## Updating a legacy installation

This template release accepts only `CYB-` App IDs. Before updating an installation with a legacy ID, complete a supported migration that preserves the app configuration and consent history, then copy the actual `CYB-` App ID from the dashboard. Do not change an ID prefix by hand: that does not migrate the app. Verify the migrated configuration, update the tag, and preview before publishing.

## Behavior

- Native GTM consent APIs manage `ad_storage`, `analytics_storage`, `ad_user_data` and `ad_personalization`.
- The fixed Google developer ID is `dZTNmYW`.
- The template uses `https://cmp.cybexo.com/loader.js`, shared by every platform, and passes choices through the native GTM bridge. App, contract, installer and Google owner determine compatibility; build numbers are diagnostic.
- `wait_for_update` accepts 500–10,000 milliseconds for asynchronous loading; invalid or out-of-range values use 500 milliseconds. It does not wait for a visitor indefinitely or prove that the CMP is ready.
- Repeated tag execution shares the loader. Loader failure is reported as failure; script-load success alone does not certify CMP readiness.

## Support and license

[Developer documentation](https://developer.cybexo.com/) · [CYBEXO](https://cybexo.com/)

This repository uses the [Apache License 2.0](LICENSE). The publisher bootstrap is the existing CYBEXO Web CMP artifact; its exact source and provenance are recorded in [publisher/README.md](publisher/README.md).

## Runtime update delivery

This source candidate uses the single public loader and engine contract v1. Its connector marker `gtm-v1.0.0` is diagnostic; it does not select an engine release. It observes engine readiness and choices through supported sandbox APIs; the native callback remains the only Google update writer. Repository changes do not update an installed Gallery template or container.

When this template version becomes available, review the Gallery update, preview the existing consent tag and publish the container. Keep the same App ID, tag settings and consent initialization trigger. Saved choices retain the engine's existing validation rules. A shared engine release reaches a new page load under the managed delivery policy; installed template updates still require Gallery review and container publication. See [shared delivery and maintainer checks](docs/engine-release-adoption.md).
