# Historical publisher TCF bootstrap

`tcf-bootstrap.js` is retained as historical compatibility evidence from immutable Web CMP release `1.5.41-dc8923e48269`, generated from Web source commit `04a91543` with build ID `production.20261009.070006.runlocal.04a91543`. Its 1,236 bytes are unchanged from the previously shipped 1.5.32 bootstrap. The historical package descriptor is [engine-release.json](engine-release.json). It is maintained with the Web engine and licensed under this repository's Apache-2.0 license. No new fork of the Web implementation is introduced here.

- Artifact SHA-256: `21e06e016ba11d83ef9634b798e79fa697ca368415a66112fbb9530ab78e7d6a`
- Artifact size: 1,236 bytes.
- Immutable bootstrap: `https://cmp.cybexo.com/releases/1.5.41-dc8923e48269/tcf-bootstrap.js`
- Bootstrap SRI: `sha384-XJ+QMWVaYoQHdg4EzFO01XDXyOMdzFWKn0c35kM/iN2lT7YE3MjU2LBA4Q2YvTLn`
- Paired loader SHA-256: `d0b9492e1c92caccbee3df1e5aab538b83091f67d9960a1d971defca1d4c8842`

`tcf-bootstrap-inline.html` retains the exact historical synchronous wrapper. The recovery uses one public `loader.js` and does not prescribe this large inline program or a second bootstrap URL for new customer installations. Early native reservation through that same loader is implemented using `data-gtm-bootstrap="on"`; real platform qualification remains deferred before publication. Existing historical installation bytes and hashes remain unchanged here for compatibility review.

The API contract follows the [IAB CMP API specification](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md). The [IAB reference stub](https://github.com/InteractiveAdvertisingBureau/iabtcf-es/blob/9530951dc989a5b8fb296706f4fd6895e91dd0c3/modules/stub/src/stub.js) was inspected for comparison; this package reuses the already-qualified CYBEXO artifact rather than copying that implementation. In particular, the CYBEXO bridge retains a requesting frame for repeated listener responses and reports `apiVersion` in stub ping.

The marker `__cybexoTcfBridgeInstalled` prevents the production loader's fallback from installing a second bridge. The no-argument `__tcfapi()` call exposes the queued arguments for the full CMP handoff. Preserve the existing API/queue and the marker when integrating; do not set this marker manually.

`node --test scripts/publisher-bootstrap.test.mjs` verifies the shipped bytes, inline wrapper and bootstrap behavior using Node's built-in test runner. Same-document full-loader qualification is recorded separately against the historical pinned production package; unit tests alone do not prove browser installation.
