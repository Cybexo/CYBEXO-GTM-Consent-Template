import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the shipped sandbox source, with only the documented GTM APIs.
const template = fs.readFileSync(new URL('../template.tpl', import.meta.url), 'utf8');
const section = name => template.split('___' + name + '___')[1].split('\n___')[0].trim();
const code = section('SANDBOXED_JS_FOR_WEB_TEMPLATE');
const release = '1.5.40-23fc15424d75';
const build = 'production.20261009.031052.runlocal.65b35513';
const keys = ['ad_storage', 'analytics_storage', 'ad_user_data', 'ad_personalization'];
const denied = Object.fromEntries(keys.map(key => [key, 'denied']));
const granted = Object.fromEntries(keys.map(key => [key, 'granted']));
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
function snapshot(overrides = {}) {
  return {
    schema: 'cybexo.consent.v1', revision: 1, decisionRevision: 0, state: 'ready',
    pending: false, decisionMade: false, uiVisible: true, lastDecisionAction: null,
    analytics: {choice: null, effective: false}, tcf: {applicable: true, valid: false, tcString: null},
    google: {signals: denied, enabled: true, owner: 'native-gtm', reason: null},
    identity: {contractVersion: 1, appId: 'CYB-fixture001', engineRelease: release,
      engineVersion: '1.5.40', buildId: build, installationPlatform: 'gtm',
      adapterVersion: 'gtm-v1.0.0', googleOwner: 'native-gtm', configurationKey: 'fixture-config'},
    error: null, ...overrides
  };
}
function harness({existingEngine, subscriptionUnavailable = false, nativeThrows = false, installerOwner} = {}) {
  const calls = [], store = new Map(), globals = {}, loads = [], later = [], timers = new Map(), listeners = new Set();
  let engine = existingEngine, timerId = 0, tagId = 0, current;
  const apis = {
    logToConsole: message => calls.push(['log', message]),
    injectScript: (url, success, failure, token) => { loads.push({url, success, failure, token}); },
    gtagSet: (...args) => calls.push(['developer', ...args]),
    setDefaultConsentState: value => calls.push(['default', clone(value)]),
    updateConsentState: value => { if (nativeThrows) throw new Error('native unavailable'); calls.push(['update', clone(value)]); },
    setInWindow: (key, value, overwrite) => {
      if (globals[key] !== undefined && !overwrite) return false;
      globals[key] = value;
      return true;
    },
    copyFromWindow: path => { if (path === 'cybexoCmpInstallationV1') return clone(installerOwner); assert.equal(path, 'CybexoConsentEngine.contractVersion'); return engine?.contractVersion; },
    callInWindow: (path, ...args) => {
      calls.push(['execute', path]);
      if (path === 'setTimeout') { assert.equal(args[1], 100); const id = ++timerId; timers.set(id, args[0]); return id; }
      if (path === 'clearTimeout') { timers.delete(args[0]); return; }
      if (path === 'CybexoConsentEngine.getSnapshot') return engine?.getSnapshot();
      if (path === 'CybexoConsentEngine.subscribe') return engine?.subscribe(args[0]);
      assert.fail('undeclared window API: ' + path);
    },
    callLater: callback => later.push(callback),
    templateStorage: {getItem: key => store.get(key), setItem: (key, value) => store.set(key, value)},
    JSON: {parse: text => { try { return JSON.parse(text); } catch { return undefined; } },
      stringify: value => { try { return JSON.stringify(value); } catch { return undefined; } }},
    getType: value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
    encodeUriComponent: encodeURIComponent
  };
  function run(data = {}) {
    const id = ++tagId;
    vm.runInNewContext(code, {require: key => { assert.ok(key in apis, key); return apis[key]; }, data: {
      settingsId: 'CYB-fixture001', regionList: '', waitForUpdateMs: 500,
      gtmOnSuccess: () => calls.push(['success', id]), gtmOnFailure: () => calls.push(['failure', id]), ...data
    }});
  }
  function install(value = snapshot(), version = 1) {
    current = value;
    engine = {contractVersion: version, getSnapshot: () => clone(current), subscribe: callback => {
      if (subscriptionUnavailable) return undefined;
      listeners.add(callback);
      callback({type: 'initial', snapshot: clone(current)});
      return () => { calls.push(['unsubscribe']); listeners.delete(callback); };
    }};
  }
  function publish(value, type = 'committed') {
    current = value;
    for (const listener of [...listeners]) listener({type, snapshot: clone(current)});
  }
  function flush() {
    for (let count = 0; later.length; count++) {
      assert.ok(count < 100, 'observation must not self-loop');
      later.shift()();
    }
  }
  function tick() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); }
  return {calls, loads, later, timers, listeners, run, install, publish, flush, tick, globals, store,
    owner: () => store.get('cybexoConsentOwner'), updates: () => calls.filter(call => call[0] === 'update'),
    native: value => globals.cybexoGtmConsentUpdate(value),
    ready: (value = snapshot()) => { run(); install(value); loads[0].success(); flush(); }};
}

test('download success is not readiness; late contract attaches once through supported sandbox APIs', () => {
  const h = harness(); h.run(); h.loads[0].success(); h.flush();
  assert.equal(h.owner().status, 'loaded'); assert.equal(h.owner().contractState, 'ENGINE_PENDING');
  assert.equal(h.timers.size, 1); assert.equal(h.listeners.size, 0);
  h.tick(); h.install(snapshot({state: 'pending', pending: true})); h.tick(); h.flush();
  assert.equal(h.owner().contractState, 'ENGINE_PENDING'); assert.equal(h.listeners.size, 1); assert.equal(h.timers.size, 0);
  h.publish(snapshot({revision: 2}), 'ready'); h.flush();
  assert.equal(h.owner().contractState, 'ENGINE_READY'); assert.deepEqual(h.updates(), []);
});

test('delayed observation rereads withdrawal; it never replays captured grant or becomes a second writer', () => {
  const h = harness(); h.ready();
  assert.equal(h.native(granted), true);
  h.publish(snapshot({revision: 2, decisionRevision: 1, decisionMade: true, lastDecisionAction: 'accept-all', google: {enabled: true, owner: 'native-gtm', signals: granted}}));
  assert.equal(h.native(denied), true);
  h.publish(snapshot({revision: 3, decisionRevision: 2, decisionMade: true, lastDecisionAction: 'reject-all'}));
  assert.equal(h.later.length, 1); h.flush();
  assert.deepEqual(h.updates(), [['update', granted], ['update', denied]]);
  assert.equal(h.owner().snapshot.revision, 3); assert.equal(h.owner().snapshot.decisionRevision, 2);
  assert.deepEqual(clone(h.owner().snapshot.signals), denied);
  assert.equal(h.owner().snapshot.lastDecisionAction, 'reject-all');
});

test('restore, reopen and unsaved cancel observe the saved choice without additional native writes', () => {
  const h = harness(); h.run();
  // Core restore transport can run before the public contract is installed.
  assert.equal(h.native(granted), true);
  const saved = snapshot({revision: 4, decisionMade: true, uiVisible: false, lastDecisionAction: 'restore',
    analytics: {choice: true, effective: true}, google: {enabled: true, owner: 'native-gtm', signals: granted}});
  h.install(saved); h.loads[0].success(); h.flush();
  h.publish({...saved, revision: 5, uiVisible: true}, 'visibility'); h.flush();
  h.publish({...saved, revision: 6, uiVisible: false}, 'visibility'); h.flush();
  assert.deepEqual(h.updates(), [['update', granted]]);
  assert.equal(h.owner().snapshot.decisionRevision, 0); assert.equal(h.owner().snapshot.lastDecisionAction, 'restore');
  assert.equal(h.owner().snapshot.analyticsEffective, true); assert.equal(h.owner().snapshot.uiVisible, false);
});

test('transaction-pending v1 snapshot does not replace the core native callback vector', () => {
  const h = harness(); h.ready(snapshot({pending: true, google: {enabled: true, owner: 'native-gtm', signals: null}}));
  assert.equal(h.native(granted), true);
  assert.deepEqual(h.updates(), [['update', granted]]);
  assert.equal(h.owner().snapshot.signals, null);
});

test('Google emission off retains observed calculated signals but cannot emit native updates', () => {
  const off = snapshot({decisionMade: true, identity: {...snapshot().identity, googleOwner: 'none'},
    google: {enabled: false, owner: 'none', signals: granted}});
  const h = harness(); h.ready(off);
  assert.equal(h.owner().contractState, 'GOOGLE_DISABLED');
  assert.deepEqual(clone(h.owner().snapshot.signals), granted);
  assert.equal(h.native(granted), false); assert.deepEqual(h.updates(), []);
  assert.equal(h.calls.filter(call => call[0] === 'default').length, 1);
});

for (const [mode, value] of [
  ['TCF', {...granted, analytics_storage: 'denied'}],
  ['US', {...granted, ad_user_data: 'denied', ad_personalization: 'denied'}],
  ['global', {...denied, analytics_storage: 'granted'}]
]) test(mode + ' engine-calculated native vector is preserved without adapter policy remapping', () => {
  const h = harness(); h.ready(snapshot({tcf: {applicable: mode === 'TCF', valid: mode === 'TCF', tcString: mode === 'TCF' ? 'engine-bytes' : null}}));
  assert.equal(h.native(value), true); h.flush(); assert.deepEqual(h.updates(), [['update', value]]);
});

test('adapter-status causes no new read, write, subscription or fake acknowledgment', () => {
  const h = harness(); h.ready(); const count = h.calls.length;
  h.publish(snapshot(), 'adapter-status'); h.flush();
  assert.equal(h.calls.length, count); assert.equal(h.listeners.size, 1);
  assert.doesNotMatch(code, /registerAdapter|\.report\(|acknowledged/);
});

for (const field of ['appId', 'engineRelease', 'engineVersion', 'buildId', 'installationPlatform', 'adapterVersion', 'googleOwner']) {
  test('wrong ' + field + ' fails closed and removes the observer', () => {
    const h = harness(); h.ready();
    h.publish(snapshot({revision: 2, identity: {...snapshot().identity, [field]: 'wrong'}})); h.flush();
    assert.equal(h.owner().contractState, 'ENGINE_IDENTITY_MISMATCH'); assert.equal(h.owner().status, 'failed');
    assert.equal(h.listeners.size, 0); assert.equal(h.timers.size, 0);
    assert.equal(h.native(granted), false); assert.deepEqual(h.updates(), [['update', denied]]);
  });
}

test('unsupported contract fails pending callers exactly once and cannot revive after load', () => {
  const h = harness(); h.run(); h.run(); h.install(snapshot(), 2);
  assert.equal(h.native(granted), false); h.loads[0].success(); h.flush();
  assert.equal(h.owner().contractState, 'ENGINE_CONTRACT_INCOMPATIBLE');
  assert.deepEqual(h.calls.filter(call => ['success', 'failure'].includes(call[0])), [['failure', 1], ['failure', 2]]);
  assert.deepEqual(h.updates(), [['update', denied]]);
});

test('unavailable subscription is not reported as a ready integration', () => {
  const h = harness({subscriptionUnavailable: true}); h.ready();
  assert.equal(h.owner().status, 'failed'); assert.equal(h.owner().contractState, 'ENGINE_SUBSCRIPTION_UNAVAILABLE');
  assert.deepEqual(h.updates(), [['update', denied]]);
});

test('existing Direct or WordPress engine prevents GTM defaults, loader and callback takeover', () => {
  for (const platform of ['direct', 'wordpress']) {
    const h = harness({existingEngine: {contractVersion: 1, platform}}); h.run();
    assert.deepEqual(h.loads, []); assert.equal(h.globals.cybexoGtmConsentUpdate, undefined);
    assert.ok(!h.calls.some(call => ['default', 'developer', 'update'].includes(call[0])));
    assert.deepEqual(h.calls.at(-1), ['failure', 1]);
  }
});

test('same owner duplicates preserve native consent and use one subscription', () => {
  const h = harness(); h.ready(); h.native(granted); h.flush(); h.run(); h.run();
  assert.equal(h.loads.length, 1); assert.equal(h.listeners.size, 1);
  assert.equal(h.calls.filter(call => call[0] === 'default').length, 1);
  assert.equal(h.calls.filter(call => call[0] === 'execute' && call[1] === 'CybexoConsentEngine.subscribe').length, 1);
  assert.deepEqual(h.updates(), [['update', granted]]);
});

test('conflicting tag cancels subscription and stale queued observation cannot revive', () => {
  const h = harness(); h.ready();
  h.publish(snapshot({revision: 2})); assert.equal(h.later.length, 1);
  h.run({settingsId: 'CYB-other00001'}); h.flush();
  assert.equal(h.listeners.size, 0); assert.equal(h.owner().status, 'failed');
  assert.equal(h.native(granted), false); assert.deepEqual(h.updates(), [['update', denied]]);
  assert.equal(h.owner().snapshot.revision, 1);
});

test('conflicting release cannot join the current template owner', () => {
  const h = harness(); h.ready(); h.owner().engineRelease = 'previous-release'; h.run();
  assert.equal(h.loads.length, 1); assert.equal(h.listeners.size, 0);
  assert.equal(h.native(granted), false); assert.deepEqual(h.updates(), [['update', denied]]);
});

test('missing API polling is bounded; later legitimate transport can attach to latest state', () => {
  const h = harness(); h.run(); h.loads[0].success(); h.flush();
  for (let i = 0; i < 65; i++) h.tick();
  assert.equal(h.owner().attempts, 60); assert.equal(h.timers.size, 0);
  assert.equal(h.owner().contractState, 'ENGINE_NOT_AVAILABLE'); assert.deepEqual(h.updates(), []);
  h.install(snapshot({revision: 20})); h.native(denied); h.flush();
  assert.equal(h.owner().contractState, 'ENGINE_READY'); assert.equal(h.owner().snapshot.revision, 20);
  assert.equal(h.listeners.size, 1);
});

test('failed owner clears pending timer; retained timer callback is harmless', () => {
  const h = harness(); h.run(); h.loads[0].success(); h.flush(); const stale = [...h.timers.values()][0];
  h.run({settingsId: 'CYB-other00001'}); assert.equal(h.timers.size, 0);
  h.install(); stale(); h.flush(); assert.equal(h.listeners.size, 0);
  assert.equal(h.native(granted), false); assert.deepEqual(h.updates(), [['update', denied]]);
});

test('native exception propagates to engine transport; there is no direct fallback', () => {
  const h = harness({nativeThrows: true}); h.ready();
  assert.throws(() => h.native(granted), /native unavailable/);
  assert.deepEqual(h.updates(), []); assert.doesNotMatch(code, /require\(['"](?:createArgumentsQueue|callInWindow\(['"]gtag|sendPixel)/);
  assert.ok(h.calls.filter(call => call[0] === 'execute').every(call => !/gtag|dataLayer/.test(call[1])));
});

test('window capabilities are explicit and read-only except for the one native callback', () => {
  const permissions = JSON.parse(section('WEB_PERMISSIONS'));
  const entries = permissions.find(p => p.instance.key.publicId === 'access_globals').instance.param[0].value.listItem;
  const actual = entries.map(entry => entry.mapValue.map(v => v.string ?? v.boolean));
  assert.deepEqual(actual, [
    ['cybexoGtmConsentUpdate', true, true, false],
    ['CybexoConsentEngine.contractVersion', true, false, false],
    ['CybexoConsentEngine.getSnapshot', false, false, true],
    ['CybexoConsentEngine.subscribe', false, false, true],
    ['setTimeout', false, false, true], ['clearTimeout', false, false, true],
    ['cybexoCmpInstallationV1', true, false, false]
  ]);
});


for (const platform of ['direct', 'wordpress', 'shopify', 'drupal']) for (const googleOwner of ['direct', 'none']) test(platform+' '+googleOwner+' installer refuses GTM before every native effect', () => {
  const h = harness({installerOwner: {appId: 'CYB-fixture001', platform, release, googleOwner}}); h.run();
  assert.equal(h.loads.length, 0); assert.equal(h.globals.cybexoGtmConsentUpdate, undefined);
  assert.ok(!h.calls.some(call => ['default', 'developer', 'update'].includes(call[0])));
  assert.deepEqual(h.calls.at(-1), ['failure', 1]);
});
for (const installerOwner of [undefined, false, null, true, {}, {platform: 'drupal'}, {appId: '', platform: '', release, googleOwner: 'direct'}, {appId: '', platform: 'drupal', release: '', googleOwner: 'direct'}, {appId: '', platform: 'drupal', release, googleOwner: 'unknown'}, {appId: 'CYB-fixture001', platform: 'gtm', release, googleOwner: 'native-gtm'}]) test('absent or malformed direct installer marker does not claim an owner: '+JSON.stringify(installerOwner), () => {
  const h = harness({installerOwner}); h.run(); assert.equal(h.loads.length, 1);
  assert.equal(typeof h.globals.cybexoGtmConsentUpdate, 'function');
  assert.equal(h.calls.filter(call => call[0] === 'default').length, 1);
});
test('excluded Drupal page still reserves its existing denied defaults even without an App ID', () => {
  const h = harness({installerOwner: {appId: '', platform: 'drupal', release, googleOwner: 'direct'}}); h.run();
  assert.equal(h.loads.length, 0); assert.deepEqual(h.updates(), []);
  assert.ok(!h.calls.some(call => ['default', 'developer'].includes(call[0])));
});
