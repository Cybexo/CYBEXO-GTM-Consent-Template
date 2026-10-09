import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {webcrypto,createHash} from 'node:crypto';
import vm from 'node:vm';

// Explicit cross-repository source gate; no downloaded runtime or mutable fixture.
// CYBEXO_WEB_SOURCE_ROOT points to the reviewed shared Web source checkout.
const source=process.env.CYBEXO_WEB_SOURCE_ROOT;
if(!source)test('shared Web source integration requires CYBEXO_WEB_SOURCE_ROOT',{skip:true},()=>{});
else {
 const requireWeb=createRequire(resolve(source,'package.json'));
 const {build}=requireWeb('esbuild'),{JSDOM}=requireWeb('jsdom');
 const raw=vm.runInNewContext('('+readFileSync(resolve(source,'scripts/tcf-readiness.test.mjs'),'utf8').match(/const raw=(.*);\nconst gvl=/)[1]+')');
 const compiled=await build({absWorkingDir:source,entryPoints:['cmp-ui-starter/src/loader.tsx'],bundle:true,write:false,platform:'browser',format:'iife',loader:{'.css':'empty','.svg':'dataurl','.png':'dataurl'},define:{'process.env.NODE_ENV':'"production"','__CYBEXO_CMP_BUILD_ID__':'"shared-compatible-fixture-build"'}});
 const artifact=process.env.CYBEXO_WEB_ARTIFACT;
 const engineCode=artifact?readFileSync(artifact,'utf8'):compiled.outputFiles[0].text;
 if(artifact)assert.equal(createHash('sha256').update(engineCode).digest('hex'),process.env.CYBEXO_WEB_ARTIFACT_SHA256,'exact frozen artifact');
 const expectedBuild=artifact?process.env.CYBEXO_WEB_BUILD_ID:'shared-compatible-fixture-build';
 const template=readFileSync(new URL('../template.tpl',import.meta.url),'utf8').split('___SANDBOXED_JS_FOR_WEB_TEMPLATE___')[1].split('\n___')[0];
 const plain=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
 async function until(check){for(let i=0;i<300;i++){if(check())return;await new Promise(r=>setTimeout(r,5));}assert.ok(check(),'source runtime reached expected state');}
 function page({wordpress=false,saved,early=false}={}){
  const dom=new JSDOM('<html><body></body></html>',{url:'https://shared-gtm-fixture.invalid/',runScripts:'outside-only'}),w=dom.window;
  const defaults=[],updates=[],direct=[],loads=[],requests=[],later=[],store=new Map();let release;
  const configGate=new Promise(r=>{release=r;});
  w.TextDecoder=TextDecoder;w.TextEncoder=TextEncoder;w.Response=Response;Object.defineProperty(w,'crypto',{value:webcrypto});
  Object.defineProperty(w,'event',{get:()=>undefined,configurable:true});
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.requestAnimationFrame=f=>w.setTimeout(f,0);w.cancelAnimationFrame=id=>w.clearTimeout(id);
  w.__nxgLoaderCssText=':host{display:block}';w.dataLayer=[];w.gtag=(...args)=>direct.push(args);
  w.console={...console,log(){},info(){},debug(){},warn(){},group(){},groupCollapsed(){},groupEnd(){}};
  if(wordpress)w.__cybexoWpEngineInstaller='gtm';
  for(const [key,value]of Object.entries(saved?.storage||{}))w.localStorage.setItem(key,value);
  for(const cookie of saved?.cookies?.split('; ')||[])if(cookie)w.document.cookie=cookie;
  w.fetch=async(url,init)=>{
   requests.push(String(url));
   if(/banner_config\.json/.test(String(url))){await configGate;return new Response(JSON.stringify({settingsId:'CYB-fixture001',isUserEU:true,userCountry:'DE',selectedVendorIds:[755],selectedPurposesIds:[1],publisherCC:'US',bannerLayout:'footer',revenueLabSignalMode:'off',consentMode:true}),{headers:{'content-type':'application/json'}});}
   if(/vendor-list\.json$/.test(String(url)))return new Response(JSON.stringify(raw),{headers:{'content-type':'application/json'}});
   return new Response('',{status:init?.method==='POST'?202:200});
  };
  const apis={
   logToConsole(){},gtagSet(){},setDefaultConsentState:value=>defaults.push(plain(value)),updateConsentState:value=>updates.push(plain(value)),
   copyFromWindow:path=>plain(path.split('.').reduce((value,key)=>value?.[key],w)),
   callInWindow:(path,...args)=>{const parts=path.split('.'),key=parts.pop(),owner=parts.reduce((value,part)=>value?.[part],w);return owner?.[key]?.(...args);},
   setInWindow:(name,fn,overwrite)=>{if(w[name]!==undefined&&!overwrite)return false;w[name]=fn;return true;},
   callLater:fn=>later.push(fn),templateStorage:{getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)},
   injectScript:(url,success,failure)=>loads.push({url,success,failure}),
   JSON:{parse:text=>{try{return JSON.parse(text);}catch{return undefined;}},stringify:value=>{try{return JSON.stringify(value);}catch{return undefined;}}},
   getType:value=>value===null?'null':Array.isArray(value)?'array':typeof value,encodeUriComponent:encodeURIComponent
  };
  function run(){vm.runInNewContext(template,{require:name=>apis[name],data:{settingsId:'CYB-fixture001',gtmOnSuccess(){},gtmOnFailure:()=>assert.fail('template rejected actual shared engine')}});}
  function load(){const el=w.document.createElement('script');el.src=early?'https://cmp.cybexo.com/loader.js':loads[0].url;
   if(early){el.id='cybexo-cmp';el.setAttribute('data-settings-id','CYB-fixture001');el.setAttribute('data-gtm-bootstrap','on');if(wordpress)el.setAttribute('data-host-platform','wordpress');}
   el.setAttribute('data-consent-records','off');el.setAttribute('data-interaction-analytics','off');Object.defineProperty(w.document,'currentScript',{value:el,configurable:true});w.eval(engineCode);Object.defineProperty(w.document,'currentScript',{value:null,configurable:true});if(!early)loads[0].success();}
  function flush(){for(let i=0;later.length;i++){assert.ok(i<100,'no self-polling');later.shift()();}}
  return {w,dom,defaults,updates,direct,loads,requests,run,load,flush,release,owner:()=>store.get('cybexoConsentOwner'),saved:()=>({storage:Object.fromEntries(Object.keys(w.localStorage).map(key=>[key,w.localStorage.getItem(key)])),cookies:w.document.cookie})};
 }
 for(const early of [false,true])for(const wordpress of [false,true])test(`actual shared loader + sandbox: ${wordpress?'WordPress':'Direct'} host, ${early?'early handoff':'template injection'} has one native owner through choice, cancel, restore and withdrawal`,async()=>{
  let p=page({wordpress,early});
  try{
   if(early){p.load();assert.equal(p.requests.length,0);assert.equal(p.defaults.length,0);assert.equal(p.direct.length,0);assert.equal(typeof p.w.__tcfapi,'function');assert.equal(p.w.CybexoConsentEngine,undefined);}
   p.run();assert.equal(p.defaults.length,1);assert.equal(p.loads.length,early?0:1);if(!early)p.load();p.flush();
   assert.equal(typeof p.w.__tcfapi,'function');assert.equal(p.w.CybexoConsentEngine,undefined);assert.equal(p.direct.length,0);
   assert.equal(p.owner().contractState,'ENGINE_NOT_AVAILABLE');p.release();
   await until(()=>p.w.CybexoConsentEngine?.getSnapshot().state==='ready');p.flush();
   assert.equal(p.owner().contractState,'ENGINE_READY');
   let snapshot=p.w.CybexoConsentEngine.getSnapshot();
   assert.equal(snapshot.identity.hostPlatform,wordpress?'wordpress':'direct');assert.equal(snapshot.identity.installer,'gtm');assert.equal(snapshot.identity.installationPlatform,'gtm');
   assert.equal(snapshot.identity.googleOwner,'native-gtm');assert.equal(p.owner().snapshot.buildId,expectedBuild);
   await p.w.handleCMPAction('accept');p.flush();
   snapshot=p.w.CybexoConsentEngine.getSnapshot();assert.equal(snapshot.analytics.effective,true);assert.deepEqual(p.updates.at(-1),plain(snapshot.google.signals));
   const saved=p.saved(),tc=snapshot.tcf.tcString,writes=p.updates.length;
   for(const visible of [true,false])p.w.dispatchEvent(new p.w.CustomEvent('cybexo:consent-ui-visibility',{detail:{visible}}));p.flush();
   assert.equal(p.updates.length,writes);assert.equal(p.w.CybexoConsentEngine.getSnapshot().tcf.tcString,tc);assert.deepEqual(p.saved(),saved);
   p.run();assert.equal(p.defaults.length,1);assert.equal(p.loads.length,early?0:1);assert.equal(p.direct.length,0);
   p.dom.window.close();p=page({wordpress,saved,early});if(early)p.load();p.run();if(!early)p.load();p.release();
   await until(()=>p.w.CybexoConsentEngine?.getSnapshot().state==='ready');p.flush();
   snapshot=p.w.CybexoConsentEngine.getSnapshot();assert.equal(snapshot.lastDecisionAction,'restore');assert.equal(snapshot.tcf.tcString,tc);assert.deepEqual(p.saved(),saved);assert.equal(p.owner().snapshot.lastDecisionAction,'restore');
   await p.w.handleCMPAction('reject');p.flush();snapshot=p.w.CybexoConsentEngine.getSnapshot();
   assert.equal(snapshot.analytics.effective,false);assert.ok(Object.values(p.updates.at(-1)).every(v=>v==='denied'));assert.equal(p.owner().snapshot.lastDecisionAction,'reject-all');
   assert.equal(p.defaults.length,1);assert.equal(p.direct.length,0);
  }finally{p.dom.window.close();}
 });
}
