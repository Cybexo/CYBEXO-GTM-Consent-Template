# CYBEXO GTM Consent Template

Install CYBEXO CMP through the Google Tag Manager Community Template Gallery. The template sets Google Consent Mode defaults and updates the four Google consent values when a visitor makes or changes a choice.

## Install

1. Copy your **CYB App ID** (shown as Settings ID in the dashboard) from the CYBEXO dashboard and keep **Consent Mode enabled** for that app.
2. For a TCF installation, paste [the synchronous TCF bootstrap block](publisher/tcf-bootstrap-inline.html) near the start of each page's `<head>`, **before the GTM container snippet and scripts that depend on TCF**. The block must execute without `async`, `defer` or `type="module"`. Follow your site's Content Security Policy, including its nonce or hash requirements.
3. In GTM, open **Templates → Search Gallery**, find **Cybexo CMP**, and add the template. Create a tag using it and enter your **CYB App ID**.
4. Keep the denied global defaults unless your consent configuration requires a different setting. Regional overrides are optional. See [field and region guidance](docs/installation.md#template-fields).
5. Select **Consent Initialization – All Pages** as the tag's trigger.
6. Check fresh visits, saved choices, acceptance, mixed choices and withdrawal in Tag Assistant before publishing the container. Confirm that the template version in your workspace is the version you intend to publish.

The TCF page block supplies the API while GTM and the CMP are loading. It does not load the banner or grant consent. A GTM-only installation cannot supply an API before GTM itself runs. Sites using TCF must include the page block even when the banner is installed through the Gallery.

Use one CYBEXO consent installation per page. Do not add a second direct CMP loader or a separate `gtag('consent', ...)` setup alongside this template. See [complete installation and verification guidance](docs/installation.md).

## Updating a legacy installation

This template release accepts only `CYB-` App IDs. Before updating an installation with a legacy ID, complete a supported migration that preserves the app configuration and consent history, then copy the actual `CYB-` App ID from the dashboard. Do not change an ID prefix by hand: that does not migrate the app. Verify the migrated configuration, update the tag, and preview before publishing.

## Behavior

- Native GTM consent APIs manage `ad_storage`, `analytics_storage`, `ad_user_data` and `ad_personalization`.
- The fixed Google developer ID is `dZTNmYW`.
- The template loads the production CMP from CYBEXO's fixed endpoint and passes subsequent choices through the native GTM bridge.
- `wait_for_update` accepts 500–10,000 milliseconds for asynchronous loading; invalid or out-of-range values use 500 milliseconds. It does not wait for a visitor indefinitely or prove that the CMP is ready.
- Repeated tag execution shares the loader. Loader failure is reported as failure; script-load success alone does not certify CMP readiness.

## Support and license

[Developer documentation](https://developer.cybexo.com/) · [CYBEXO](https://cybexo.com/)

This repository uses the [Apache License 2.0](LICENSE). The publisher bootstrap is the existing CYBEXO Web CMP artifact; its exact source and provenance are recorded in [publisher/README.md](publisher/README.md).
