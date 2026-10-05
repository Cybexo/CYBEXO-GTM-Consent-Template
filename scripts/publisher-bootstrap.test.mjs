import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const artifact = fs.readFileSync(new URL('../publisher/tcf-bootstrap.js', import.meta.url), 'utf8');
const inline = fs.readFileSync(new URL('../publisher/tcf-bootstrap-inline.html', import.meta.url), 'utf8');
const expectedHash = '21e06e016ba11d83ef9634b798e79fa697ca368415a66112fbb9530ab78e7d6a';
const clone = value => JSON.parse(JSON.stringify(value));

function fixture({body = true, existing, locator = false, installed = false} = {}) {
  const listeners = {}, domEvents = {}, frames = {};
  let appendCount = 0;
  if (locator) frames.__tcfapiLocator = {name: '__tcfapiLocator'};
  const append = frame => { frames[frame.name] = frame; appendCount++; };
  const document = {
    body: body ? {appendChild: append} : null,
    createElement: () => ({style: {}}),
    addEventListener: (event, callback) => { domEvents[event] = callback; }
  };
  const window = {
    document, frames, __tcfapi: existing, __cybexoTcfBridgeInstalled: installed,
    addEventListener: (event, callback) => { (listeners[event] ||= []).push(callback); }
  };
  const context = vm.createContext({
    window,
    fetch: () => assert.fail('bootstrap must not request a resource'),
    localStorage: new Proxy({}, {get: () => assert.fail('bootstrap must not access storage')})
  });
  const run = () => vm.runInContext(artifact, context);
  run();
  return {window, run, listeners, domEvents, append, appendCount: () => appendCount};
}

test('publisher artifact is the frozen Web 1.5.32 bootstrap and inline bytes match', () => {
  assert.equal(createHash('sha256').update(artifact).digest('hex'), expectedHash);
  assert.equal(Buffer.byteLength(artifact), 1236);
  assert.equal(inline.match(/<script>\n([\s\S]*)<\/script>/)?.[1], artifact);
  assert.doesNotMatch(inline, /<script[^>]+(?:async|defer|module)/);
});

test('before any loader runs, ping is synchronous and TCF calls remain queued', () => {
  const {window} = fixture();
  let returned = false;
  window.__tcfapi('ping', 2, (ping, success) => {
    assert.equal(success, true);
    assert.deepEqual(clone(ping), {cmpLoaded: false, cmpStatus: 'stub', apiVersion: '2'});
    assert.equal(ping.gdprApplies, undefined);
    returned = true;
  });
  assert.equal(returned, true);
  const first = () => assert.fail('must not invent consent');
  const second = () => assert.fail('must not invent consent');
  window.__tcfapi('addEventListener', 2, first);
  window.__tcfapi('getTCData', 2, second);
  const queue = window.__tcfapi();
  assert.deepEqual(Array.from(queue, args => args[0]), ['addEventListener', 'getTCData']);
  assert.equal(queue[0][2], first);
  assert.equal(queue[1][2], second);
});

test('publisher GDPR applicability is explicit and does not become a consent grant', () => {
  const {window} = fixture();
  let result;
  window.__tcfapi('setGdprApplies', 2, (value, success) => { result = [value, success]; }, true);
  assert.deepEqual(result, ['set', true]);
  window.__tcfapi('ping', 2, ping => {
    assert.equal(ping.gdprApplies, true);
    assert.equal(ping.cmpLoaded, false);
    assert.equal(ping.tcString, undefined);
  });
});

test('head installation defers only the locator until body is available', () => {
  const f = fixture({body: false});
  assert.equal(typeof f.window.__tcfapi, 'function');
  assert.equal(f.listeners.message.length, 1);
  assert.equal(f.appendCount(), 0);
  f.window.document.body = {appendChild: f.append};
  f.domEvents.DOMContentLoaded();
  assert.equal(f.appendCount(), 1);
  assert.equal(f.window.frames.__tcfapiLocator.style.display, 'none');
});

test('repeated installation preserves queue, function and exactly one bridge/locator', () => {
  const f = fixture(), original = f.window.__tcfapi;
  original('addEventListener', 2, () => {});
  const queue = original();
  f.run();
  assert.equal(f.window.__tcfapi, original);
  assert.equal(f.window.__tcfapi(), queue);
  assert.equal(queue.length, 1);
  assert.equal(f.listeners.message.length, 1);
  assert.equal(f.appendCount(), 1);
});

test('existing generic API and queue remain owned by their existing function', () => {
  const queue = [['addEventListener', 2, () => {}]];
  const existing = () => queue;
  const f = fixture({existing, locator: true});
  assert.equal(f.window.__tcfapi, existing);
  assert.equal(f.window.__tcfapi(), queue);
  assert.equal(f.appendCount(), 0);
});

test('existing fallback marker prevents a second bridge from being installed', () => {
  const existing = () => [];
  const f = fixture({existing, installed: true});
  assert.equal(f.window.__tcfapi, existing);
  assert.equal(f.listeners.message, undefined);
  assert.equal(f.appendCount(), 0);
});

for (const encoding of ['object', 'json']) test(`${encoding} frame listener retains sender for repeated replies after handoff`, () => {
  const f = fixture(), replies = [];
  const source = {postMessage: (reply, origin) => replies.push({reply: typeof reply === 'string' ? JSON.parse(reply) : reply, origin})};
  const request = {__tcfapiCall: {command: 'addEventListener', version: 2, callId: 'early-listener'}};
  f.listeners.message[0]({data: encoding === 'json' ? JSON.stringify(request) : request, source, origin: 'https://vendor.example'});
  assert.equal(replies.length, 0);
  const queued = f.window.__tcfapi();
  let callback;
  f.window.__tcfapi = (command, version, registered) => { callback = registered; };
  f.window.__tcfapi(...queued[0]);
  callback({listenerId: 1, eventStatus: 'cmpuishown'}, true);
  callback({listenerId: 1, eventStatus: 'useractioncomplete'}, true);
  assert.equal(replies.length, 2);
  assert.ok(replies.every(row => row.origin === 'https://vendor.example' && row.reply.__tcfapiReturn.callId === 'early-listener'));
});

test('invalid messages cannot prevent a later valid synchronous ping', () => {
  const f = fixture();
  for (const data of ['{', null, {}, {__tcfapiCall: {command: 4}}]) {
    f.listeners.message[0]({data, source: {}, origin: 'null'});
  }
  let ping;
  f.window.__tcfapi('ping', 2, value => { ping = value; });
  assert.equal(ping.cmpStatus, 'stub');
});
