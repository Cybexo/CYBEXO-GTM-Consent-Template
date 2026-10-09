# Publisher TCF bootstrap

`tcf-bootstrap.js` is paired with immutable Web CMP release `1.5.40-23fc15424d75`, generated from Web source commit `65b35513` with build ID `production.20261009.031052.runlocal.65b35513`. Its 1,236 bytes are unchanged from the previously shipped 1.5.32 bootstrap. The exact selected package descriptor is [engine-release.json](engine-release.json). It is maintained with the Web engine and licensed under this repository's Apache-2.0 license. No new fork of the Web implementation is introduced here.

- Artifact SHA-256: `21e06e016ba11d83ef9634b798e79fa697ca368415a66112fbb9530ab78e7d6a`
- Artifact size: 1,236 bytes.
- Immutable bootstrap: `https://cmp.cybexo.com/releases/1.5.40-23fc15424d75/tcf-bootstrap.js`
- Bootstrap SRI: `sha384-XJ+QMWVaYoQHdg4EzFO01XDXyOMdzFWKn0c35kM/iN2lT7YE3MjU2LBA4Q2YvTLn`
- Paired loader SHA-256: `fa8e4e31806ba309c52a281f785eb4c5e6576dcbeb01aa123889b80860098fee`

`tcf-bootstrap-inline.html` wraps those exact JavaScript bytes in a synchronous script block for publishers. Copy the block into the page before the GTM snippet and TCF-dependent scripts. Add the site's CSP nonce where required. The inline form performs no fetch and is available even while the main CMP loader is blocked; it still requires CSP permission to execute.

The API contract follows the [IAB CMP API specification](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md). The [IAB reference stub](https://github.com/InteractiveAdvertisingBureau/iabtcf-es/blob/9530951dc989a5b8fb296706f4fd6895e91dd0c3/modules/stub/src/stub.js) was inspected for comparison; this package reuses the already-qualified CYBEXO artifact rather than copying that implementation. In particular, the CYBEXO bridge retains a requesting frame for repeated listener responses and reports `apiVersion` in stub ping.

The marker `__cybexoTcfBridgeInstalled` prevents the production loader's fallback from installing a second bridge. The no-argument `__tcfapi()` call exposes the queued arguments for the full CMP handoff. Preserve the existing API/queue and the marker when integrating; do not set this marker manually.

`node --test scripts/publisher-bootstrap.test.mjs` verifies the shipped bytes, inline wrapper and bootstrap behavior using Node's built-in test runner. Same-document full-loader qualification is recorded separately against the pinned production package; unit tests alone do not prove browser installation.
