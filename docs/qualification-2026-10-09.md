# Dedicated GTM qualification — October 9, 2026

The common-loader template is deployed in the dedicated `GTM-TBQSTS2P` container, Version 3. The shared engine remains Web CMP **1.5.42**, build `production.20261009.160356.runlocal.0a91cbcb`; no separate GTM engine build was created. Template code was frozen at `0f1dd30781463ad1b9a1ac3c147fdca04b982c32`; the early-loader installation/cache correction is at `ac068a3f977aed41886b13042361240ee659dffc`.

The qualification host is `cybexo-web-qualification.pages.dev`. Its Basic, Advanced, actual regional TCF path and template-only fallback were exercised. All other platform wiring remains outside this milestone.

- 150 local source cases, four integrations with the exact frozen production loader, and 11 tests in Google's template editor passed.
- Twenty-four retained browser states checked native defaults/updates, saved choices, reject, accept, unsaved cancellation, Analytics withdrawal, purpose 1/3/4 restrictions, Google vendor refusal, early reservation, fallback injection and startup failures.
- Independent TC decoding checked CMP 471, policy 5, GVL 179, service-specific scope and Google vendor disclosure against the browser API.
- Four permitted Google requests returned HTTP 204. The Advanced probe was also visible in GA4 DebugView with its matching page and session. Tag Assistant independently showed denied defaults and restored Analytics denial.
- Ten completed choices matched ten durable consent records, reporting receipts and archive objects. Thirteen network attempts included three identical retries without duplicate decisions.

A fresh event requested after a saved Purpose 4 refusal carried `npa=1` and the updated Google consent encoding while Analytics remained permitted. Google can batch an earlier event until after later UI changes; the audit distinguishes event creation order from network send time.

The early script uses the stable `?data-gtm-bootstrap=on` query. A real retained browser cache otherwise served an old bare-loader response. The stable query loads the same shared artifact and avoids that historical entry; it is not a per-platform build/version. Follow the exact [short installation](installation.md#tcf-page-setup).

Basic-mode collection blocking also depends on site tag configuration. This dedicated site uses a separate first-party Analytics gate to release its single test Google tag only after a completed Analytics grant, disable it immediately on withdrawal and reload. Native denied state alone does not prevent all Google network traffic. Advanced mode deliberately initializes the Google library under denied defaults. Those delivery choices are site wiring, not competing CMP engines.

This is bounded internal qualification, not Google or IAB certification. The public Gallery revision, DeveloperDocs, dashboard installation output and customer containers have not been updated to this source. Broader regional execution, other browsers and other platform integrations require their own evidence. A template-only installation cannot expose TCF before GTM executes. Installations using an old cached bare loader require an explicit migration check.
