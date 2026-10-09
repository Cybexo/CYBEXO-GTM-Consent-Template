import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the shipped sandbox source, with only the documented GTM APIs.
const template = fs.readFileSync(new URL('../template.tpl', import.meta.url), 'utf8');
const section = name => template.split('___' + name + '___')[1].split('\n___')[0].trim();
const code = section('SANDBOXED_JS_FOR_WEB_TEMPLATE');
const release = '1.5.41-dc8923e48269';
const build = 'production.20261009.070006.runlocal.04a91543';
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
      engineVersion: '1.5.41', buildId: build, installationPlatform: 'gtm',
      adapterVersion: 'gtm-v1.0.0', googleOwner: 'native-gtm', configurationKey: 'fixture-config'},
    error: null, ...overrides
  };
}
function harness({existingEngine, subscriptionUnavailable = false, nativeThrows = false, installerOwner, context, wpInstaller, bootstrap, resume} = {}) {
  const calls = [], store = new Map(), globals = {}, loads = [], later = [], listeners = new Set();
  let engine = existingEngine, tagId = 0, current;
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
    copyFromWindow: path => { if (path === 'cybexoCmpInstallationV1') return clone(installerOwner); if (path === 'cybexoCmpContextV1') return clone(context); if (path === '__cybexoWpEngineInstaller') return wpInstaller; if (path === '__cybexoNativeGtmBootstrap') return clone(bootstrap); assert.equal(path, 'CybexoConsentEngine.contractVersion'); return engine?.contractVersion; },
    callInWindow: (path, ...args) => {
      calls.push(['execute', path]);
      assert.ok(!['setTimeout','clearTimeout','setInterval','clearInterval'].includes(path), 'GTM forbids predefined Window timer keys');
      if (path === 'cybexoCmpResumeGtm') return resume?.(...args);
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
  return {calls, loads, later, listeners, run, install, publish, flush, globals, store,
    owner: () => store.get('cybexoConsentOwner'), updates: () => calls.filter(call => call[0] === 'update'),
    native: value => globals.cybexoGtmConsentUpdate(value),
    ready: (value = snapshot()) => { run(); install(value); loads[0].success(); flush(); }};
}

test('download success is not readiness; late native transport attaches once through supported sandbox APIs', () => {
  const h = harness(); h.run(); h.loads[0].success(); h.flush();
  assert.equal(h.owner().status, 'loaded'); assert.equal(h.owner().contractState, 'ENGINE_NOT_AVAILABLE');
  assert.equal(h.owner().attempts, 1); assert.equal(h.later.length, 0); assert.equal(h.listeners.size, 0);
  h.install(snapshot({state: 'pending', pending: true})); h.native(denied); h.flush();
  assert.equal(h.owner().contractState, 'ENGINE_PENDING'); assert.equal(h.listeners.size, 1);
  h.publish(snapshot({revision: 2}), 'ready'); h.flush();
  assert.equal(h.owner().contractState, 'ENGINE_READY'); assert.deepEqual(h.updates(), [['update', denied]]);
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

for (const field of ['appId', 'installationPlatform', 'installer', 'hostPlatform', 'googleOwner']) {
  test('wrong ' + field + ' fails closed and removes the observer', () => {
    const h = harness(); h.ready();
    h.publish(snapshot({revision: 2, identity: {...snapshot().identity, [field]: 'wrong'}})); h.flush();
    assert.equal(h.owner().contractState, 'ENGINE_IDENTITY_MISMATCH'); assert.equal(h.owner().status, 'failed');
    assert.equal(h.listeners.size, 0);
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

test('conflicting contract cannot join the current template owner', () => {
  const h = harness(); h.ready(); h.owner().contractVersion = 2; h.run();
  assert.equal(h.loads.length, 1); assert.equal(h.listeners.size, 0);
  assert.equal(h.native(granted), false); assert.deepEqual(h.updates(), [['update', denied]]);
});

test('missing API does not self-poll; later legitimate transport attaches to latest state', () => {
  const h = harness(); h.run(); h.loads[0].success(); h.flush();
  assert.equal(h.owner().attempts, 1); assert.equal(h.later.length, 0);
  assert.equal(h.owner().contractState, 'ENGINE_NOT_AVAILABLE'); assert.deepEqual(h.updates(), []);
  h.install(snapshot({revision: 20})); h.native(denied); h.flush();
  assert.equal(h.owner().contractState, 'ENGINE_READY'); assert.equal(h.owner().snapshot.revision, 20);
  assert.equal(h.listeners.size, 1);
});

test('failed owner makes a retained coalesced callback harmless', () => {
  const h = harness(); h.run(); h.loads[0].success(); const stale = h.later[0];
  h.run({settingsId: 'CYB-other00001'});
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
    ['cybexoCmpInstallationV1', true, false, false],
    ['cybexoCmpContextV1', true, false, false],
    ['__cybexoWpEngineInstaller', true, false, false],
    ['__cybexoNativeGtmBootstrap', true, false, false],
    ['cybexoCmpResumeGtm', false, false, true]
  ]);
});


for (const platform of ['direct', 'wordpress', 'shopify', 'drupal']) for (const googleOwner of ['direct', 'none']) test(platform+' '+googleOwner+' installer refuses GTM before every native effect', () => {
  const h = harness({installerOwner: {appId: 'CYB-fixture001', platform, release, googleOwner}}); h.run();
  assert.equal(h.loads.length, 0); assert.equal(h.globals.cybexoGtmConsentUpdate, undefined);
  assert.ok(!h.calls.some(call => ['default', 'developer', 'update'].includes(call[0])));
  assert.deepEqual(h.calls.at(-1), ['failure', 1]);
});
for (const installerOwner of [undefined, false, null, true, {}, {appId: 'CYB-fixture001', platform: 'gtm', googleOwner: 'native-gtm'}]) test('absent or compatible legacy marker permits GTM: '+JSON.stringify(installerOwner), () => {
  const h = harness({installerOwner}); h.run(); assert.equal(h.loads.length, 1);
  assert.equal(typeof h.globals.cybexoGtmConsentUpdate, 'function');
  assert.equal(h.calls.filter(call => call[0] === 'default').length, 1);
});
test('excluded Drupal page still reserves its existing denied defaults even without an App ID', () => {
  const h = harness({installerOwner: {appId: '', platform: 'drupal', release, googleOwner: 'direct'}}); h.run();
  assert.equal(h.loads.length, 0); assert.deepEqual(h.updates(), []);
  assert.ok(!h.calls.some(call => ['default', 'developer'].includes(call[0])));
});

test('provider-forbidden predefined Window timer permissions and calls are absent', () => {
  const permissions = JSON.parse(section('WEB_PERMISSIONS'));
  const entries = permissions.find(p => p.instance.key.publicId === 'access_globals').instance.param[0].value.listItem;
  const forbidden = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'];
  assert.ok(entries.every(entry => !forbidden.includes(entry.mapValue[0].string)));
  assert.doesNotMatch(code, /callInWindow\(['"](?:setTimeout|clearTimeout|setInterval|clearInterval|requestAnimationFrame|cancelAnimationFrame)['"]/);
  const h = harness(); h.run(); h.loads[0].success(); h.flush();
  assert.equal(h.owner().attempts, 1); assert.equal(h.later.length, 0);
});

test('Google-off API arriving after the sole load observation remains honestly unavailable without writes', () => {
  const h = harness(); h.run(); h.loads[0].success(); h.flush();
  h.install(snapshot({identity: {...snapshot().identity, googleOwner: 'none'}, google: {enabled: false, owner: 'none', signals: granted}}));
  h.flush();
  assert.equal(h.owner().contractState, 'ENGINE_NOT_AVAILABLE'); assert.equal(h.listeners.size, 0);
  assert.equal(h.calls.filter(call => call[0] === 'default').length, 1); assert.deepEqual(h.updates(), []);
  assert.equal(h.later.length, 0);
});


test('one shared compatible build is accepted without exact version, build or adapter equality', () => {
  const h = harness();
  const identity = {...snapshot().identity, engineRelease: 'shared-next', engineVersion: '9.0.0',
    buildId: 'build-next', adapterVersion: 'diagnostic-next', installer: 'gtm', hostPlatform: 'direct'};
  h.ready(snapshot({identity}));
  assert.equal(h.owner().contractState, 'ENGINE_READY');
  assert.equal(h.owner().snapshot.engineRelease, 'shared-next');
  assert.equal(h.owner().snapshot.engineVersion, '9.0.0');
  assert.equal(h.owner().snapshot.buildId, 'build-next');
  assert.equal(h.native(granted), true);
  assert.deepEqual(h.updates(), [['update', granted]]);
});

for (const options of [
  {wpInstaller: 'gtm'},
  {context: {contractVersion: 1, appId: 'CYB-fixture001', hostPlatform: 'wordpress', installer: 'gtm', googleOwner: 'native-gtm'}},
  {wpInstaller: 'gtm', installerOwner: {appId: 'CYB-fixture001', platform: 'gtm', googleOwner: 'native-gtm'}}
]) test('WordPress host retains GTM installer and native owner: ' + JSON.stringify(options), () => {
  const h = harness(options); h.run();
  const url = new URL(h.loads[0].url);
  assert.equal(url.pathname, '/loader.js');
  assert.equal(url.searchParams.get('data-host-platform'), 'wordpress');
  assert.equal(url.searchParams.get('data-installer'), 'gtm');
  assert.equal(url.searchParams.get('data-google-owner'), 'native-gtm');
  assert.equal(url.searchParams.has('data-engine-release'), false);
  h.install(snapshot({identity: {...snapshot().identity, installer: 'gtm', hostPlatform: 'wordpress'}}));
  h.loads[0].success(); h.flush();
  assert.equal(h.owner().contractState, 'ENGINE_READY');
  assert.equal(h.native(granted), true); assert.equal(h.native(denied), true);
  assert.deepEqual(h.updates(), [['update', granted], ['update', denied]]);
});

for (const options of [
  {wpInstaller: 'wordpress'}, {wpInstaller: 'direct'},
  {context: {contractVersion: 2}}, {context: null},
  {context: {contractVersion: 1, appId: 'CYB-other00001'}},
  {context: {contractVersion: 1, hostPlatform: 'shopify'}},
  {context: {contractVersion: 1, hostPlatform: 'drupal'}},
  {context: {contractVersion: 1, installer: 'direct'}},
  {context: {contractVersion: 1, googleOwner: 'direct'}},
  {context: {contractVersion: 1, googleOwner: 'none'}},
  {context: {contractVersion: 1, hostPlatform: 'direct'}, wpInstaller: 'gtm'},
  {context: {contractVersion: 1, hostPlatform: 'wordpress'}, wpInstaller: 'wordpress'},
  {installerOwner: {appId: 'CYB-other00001', platform: 'gtm', googleOwner: 'native-gtm'}},
  {installerOwner: {appId: 'CYB-fixture001', platform: 'direct', googleOwner: 'direct'}},
  {installerOwner: {platform: 'drupal'}},
  {context: {contractVersion: 1, appId: 'CYB-fixture001'}, installerOwner: {appId: 'CYB-other00001'}}
]) test('conflicting declared context fails before defaults, callback or network: ' + JSON.stringify(options), () => {
  const h = harness(options); h.run();
  assert.equal(h.loads.length, 0);
  assert.equal(h.globals.cybexoGtmConsentUpdate, undefined);
  assert.ok(!h.calls.some(call => ['default', 'developer', 'update'].includes(call[0])));
  assert.deepEqual(h.calls.at(-1), ['failure', 1]);
});

test('WordPress compatibility preserves older v1 snapshots without new host fields', () => {
  const h = harness({wpInstaller: 'gtm'}); h.ready();
  assert.equal(h.owner().contractState, 'ENGINE_READY');
  assert.equal(h.native(granted), true);
});


const reservation={appId:'CYB-fixture001',hostPlatform:'direct',installer:'gtm',googleOwner:'native-gtm',state:'waiting'};
for(const hostPlatform of ['direct','wordpress'])test('matching early '+hostPlatform+' reservation resumes once after native defaults and callback without injection',()=>{
 let h,resumes=0;
 h=harness({bootstrap:{...reservation,hostPlatform},resume:appId=>{
  resumes++;assert.equal(appId,'CYB-fixture001');assert.equal(h.calls.filter(call=>call[0]==='default').length,1);assert.equal(typeof h.globals.cybexoGtmConsentUpdate,'function');return true;
 }});
 h.run();h.flush();h.run();assert.equal(resumes,1);assert.equal(h.loads.length,0);assert.equal(h.owner().hostPlatform,hostPlatform);assert.equal(h.owner().status,'loaded');
 assert.deepEqual(h.calls.filter(call=>call[0]==='success'),[['success',1],['success',2]]);assert.deepEqual(h.updates(),[]);
});
for(const bootstrap of [null,{...reservation,appId:'CYB-other00001'},{...reservation,hostPlatform:'shopify'},{...reservation,installer:'direct'},{...reservation,googleOwner:'direct'},{...reservation,state:'unknown'}])test('invalid early reservation rejects before native defaults: '+JSON.stringify(bootstrap),()=>{
 const h=harness({bootstrap,resume:()=>assert.fail('must not resume')});h.run();assert.equal(h.loads.length,0);assert.equal(h.globals.cybexoGtmConsentUpdate,undefined);assert.ok(!h.calls.some(call=>['default','developer','update'].includes(call[0])));assert.deepEqual(h.calls.at(-1),['failure',1]);
});
for(const options of [{wpInstaller:'gtm'},{context:{contractVersion:1,hostPlatform:'wordpress',installer:'gtm',googleOwner:'native-gtm'}}])test('early host conflicts fail before defaults '+JSON.stringify(options),()=>{
 const h=harness({...options,bootstrap:reservation});h.run();assert.equal(h.loads.length,0);assert.ok(!h.calls.some(call=>['default','developer','update'].includes(call[0])));assert.deepEqual(h.calls.at(-1),['failure',1]);
});
for(const resume of [undefined,()=>false])test('failed or missing resume never injects a second loader or falls back to direct: '+String(resume),()=>{
 const h=harness({bootstrap:reservation,resume});h.run();assert.equal(h.loads.length,0);assert.equal(h.owner().status,'failed');assert.deepEqual(h.updates(),[['update',denied]]);assert.equal(h.native(granted),false);
});
