# CYBEXO-GTM-Consent-Template

This repository contains the official **Google Tag Manager Community Template** for the **Cybexo Consent Management Platform (CMP)**.

The template enables websites to:

- Apply **Google Consent Mode v2** defaults and updates via GTM consent APIs
- Configure defaults with **global** values plus optional **region override**
- Set Google developer ID automatically (`developer_id.dZTNmYW`, non-editable)
- Load the Cybexo Web CMP Loader from locked Cybexo endpoints
- Ensure early execution during **Consent Initialization**

This template is intended for GTM users who want to deploy Cybexo CMP without modifying website code directly.

Repository identity: **CYBEXO-GTM-Consent-Template**.

---

## Current behavior

- Uses `setDefaultConsentState` for consent defaults.
- Accepts `wait_for_update` from 500–10000ms, defaulting invalid/out-of-range values to 500ms. This is a consent wait setting, not a tag-completion timer.
- Supports required consent types:
  - `ad_storage`
  - `analytics_storage`
  - `ad_user_data`
  - `ad_personalization`
- Registers a native `updateConsentState` callback before loading the CMP.
- Injects one CMP loader per Settings ID/page; repeated execution cannot reset a choice.
- Missing identity, malformed consent values, callback collision and script failure remain denied.
- The matching CMP runtime must support `window.cybexoGtmConsentUpdate`; deploy the runtime and template as a qualified pair. This candidate is not yet released to the Gallery.
- Passes the locked Cybexo Google developer ID to the loader as `data-developer-id`.
- Passes `data-consent-mode=off` to avoid duplicate default handling by loader.

---

## Main fields

- `settingsId` (required)
- `globalDefaultsJson`
- `regionList` (optional CSV)
- `regionDefaultsJson` (optional JSON)
- `waitForUpdateMs` (minimum enforced at `500`)

---

## Installation (via GTM Community Template Gallery)

1. Open GTM → **Templates**
2. Click **Search Gallery**
3. Search for **Cybexo CMP**
4. Add the template to your workspace
5. Create a new Tag → Select **Cybexo CMP**
6. Enter your **Settings ID**
7. Keep defaults as needed (global + optional region override)
8. Trigger it on **Consent Initialization – All Pages**
9. Validate in Tag Assistant before publishing

---

## Support

For implementation support and documentation, visit:

👉 https://developer.cybexo.com  
👉 https://cybexo.com/

---

## License

This project is licensed under **Apache License 2.0**.
