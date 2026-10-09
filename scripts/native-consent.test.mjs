import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const tpl=fs.readFileSync(new URL('../template.tpl',import.meta.url),'utf8');
const part=name=>tpl.split('___'+name+'___')[1].split('\n___')[0].trim();
const code=part('SANDBOXED_JS_FOR_WEB_TEMPLATE');
const keys=['ad_storage','analytics_storage','ad_user_data','ad_personalization'];
const denied=Object.fromEntries(keys.map(k=>[k,'denied'])),granted=Object.fromEntries(keys.map(k=>[k,'granted']));
const clone=x=>JSON.parse(JSON.stringify(x));
function setup({collision=false}={}){
 const calls=[],pending=[],parseInputs=[],store=new Map(),globals=collision?{cybexoGtmConsentUpdate:()=>{}}:{};
 const apis={
  logToConsole:(...a)=>calls.push(['log',...a]),
  injectScript:(url,success,failure,token)=>{calls.push(['inject',url,token]);pending.push({success,failure});},
  gtagSet:(...a)=>calls.push(['developer',...a]),
  setDefaultConsentState:s=>calls.push(['default',clone(s)]),
  updateConsentState:s=>calls.push(['update',clone(s)]),
  setInWindow:(key,fn,override)=>{calls.push(['register',key,override]);if(globals[key]!==undefined&&!override)return false;globals[key]=fn;return true;},
  copyFromWindow:()=>undefined,callInWindow:()=>undefined,callLater:()=>{},
  templateStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},
  JSON:{parse:s=>{parseInputs.push(s);try{return JSON.parse(s);}catch{return undefined;}},stringify:s=>{try{return JSON.stringify(s);}catch{return undefined;}}},
  getType:v=>v===null?'null':Array.isArray(v)?'array':typeof v,
  encodeUriComponent:encodeURIComponent
 };
 let nextId=0;
 const run=(data={})=>{const id=++nextId;vm.runInNewContext(code,{require:k=>{assert.ok(k in apis,k);return apis[k];},data:{settingsId:'CYB-fixture001',regionList:'',waitForUpdateMs:500,gtmOnSuccess:()=>calls.push(['success',id]),gtmOnFailure:()=>calls.push(['failure',id]),...data}});return id;};
 return {calls,pending,parseInputs,globals,run};
}
const outcomes=h=>h.calls.filter(c=>c[0]==='success'||c[0]==='failure');
test('locked attribution and denied defaults precede callback and one asynchronous loader',()=>{
 const h=setup();h.run({developerId:'override',loaderUrl:'https://evil.test/'});
 assert.deepEqual(h.calls.map(c=>c[0]),['developer','default','register','inject']);
 assert.deepEqual(h.calls[0],['developer','developer_id.dZTNmYW',true]);assert.deepEqual(h.calls[1][1],{...denied,wait_for_update:500});
 const url=new URL(h.calls[3][1]);assert.equal(url.origin,'https://cmp.cybexo.com');assert.equal(url.pathname,'/releases/1.5.40-23fc15424d75/loader.js');assert.equal(url.searchParams.has('delivery'),false);assert.equal(url.searchParams.get('data-engine-release'),'1.5.40-23fc15424d75');assert.equal(url.searchParams.get('data-engine-contract'),'1');assert.equal(url.searchParams.get('data-installation-platform'),'gtm');assert.equal(url.searchParams.get('data-adapter-version'),'gtm-v1.0.0');assert.equal(url.searchParams.get('data-consent-mode'),'off');assert.equal(url.searchParams.get('data-developer-id'),'dZTNmYW');assert.equal(h.calls[3][2],'cybexo-cmp-CYB-fixture001-1.5.40-23fc15424d75');
});
test('accept granular analytics-off and withdrawal use native updates',()=>{
 const h=setup();h.run();h.pending[0].success();for(const s of [granted,{...granted,ad_user_data:'denied'},{...granted,analytics_storage:'denied'},denied])assert.equal(h.globals.cybexoGtmConsentUpdate(s),true);
 assert.deepEqual(h.calls.filter(c=>c[0]==='update').map(c=>c[1]),[granted,{...granted,ad_user_data:'denied'},{...granted,analytics_storage:'denied'},denied]);
});
for(const input of [null,{},'malformed',{analytics_storage:'granted'},{ad_storage:true,analytics_storage:'GRANTED'},[],500])test('invalid or partial callback replaces earlier grants safely: '+JSON.stringify(input),()=>{
 const h=setup();h.run();h.globals.cybexoGtmConsentUpdate(granted);h.globals.cybexoGtmConsentUpdate(input);
 assert.deepEqual(h.calls.at(-1)[1],input?.analytics_storage==='granted'?{...denied,analytics_storage:'granted'}:denied);
});
test('inherited keys and prototype-shaped callback fields cannot grant or alter output',()=>{
 const h=setup();h.run();const inherited=Object.create(granted);inherited.analytics_storage='denied';h.globals.cybexoGtmConsentUpdate(inherited);assert.deepEqual(h.calls.at(-1),['update',denied]);
 h.globals.cybexoGtmConsentUpdate(JSON.parse('{"__proto__":{"ad_storage":"granted"},"constructor":{"prototype":{"analytics_storage":"granted"}},"analytics_storage":"granted"}'));assert.deepEqual(h.calls.at(-1),['update',{...denied,analytics_storage:'granted'}]);
 const cyclic={};cyclic.self=cyclic;h.globals.cybexoGtmConsentUpdate(cyclic);assert.deepEqual(h.calls.at(-1),['update',denied]);
});
test('extra callback fields cannot change scope or attribution',()=>{
 const h=setup();h.run();h.globals.cybexoGtmConsentUpdate({...granted,region:['US'],wait_for_update:99999,developer_id:'evil',security_storage:'granted'});assert.deepEqual(h.calls.at(-1),['update',granted]);
});
for(const result of ['success','failure'])test('two pending callers settle once from one '+result,()=>{
 const h=setup();h.run();h.run();assert.deepEqual(outcomes(h),[]);assert.equal(h.pending.length,1);assert.equal(h.calls.filter(c=>c[0]==='default').length,1);
 h.pending[0][result]();h.pending[0][result]();h.pending[0][result==='success'?'failure':'success']();assert.deepEqual(outcomes(h),[[result,1],[result,2]]);
 assert.equal(h.calls.filter(c=>c[0]==='update').length,result==='failure'?1:0);
});
test('loaded duplicate preserves accepted consent without resetting defaults',()=>{
 const h=setup();h.run();h.pending[0].success();h.globals.cybexoGtmConsentUpdate(granted);const count=h.calls.length;h.run();assert.deepEqual(h.calls.slice(count),[['success',2]]);
});
test('failed duplicate stays failed and native callback cannot revive grants',()=>{
 const h=setup();h.run();h.pending[0].failure();const count=h.calls.length;h.run();assert.deepEqual(h.calls.slice(count),[['failure',2]]);assert.equal(h.globals.cybexoGtmConsentUpdate(granted),false);assert.deepEqual(h.calls.filter(c=>c[0]==='update').at(-1),['update',denied]);
});
for(const loaded of [false,true])test('conflicting ID permanently denies without replacing owner; loaded='+loaded,()=>{
 const h=setup();h.run();h.run();if(loaded){h.pending[0].success();h.globals.cybexoGtmConsentUpdate(granted);}const callback=h.globals.cybexoGtmConsentUpdate;
 h.run({settingsId:'CYB-other00001'});assert.equal(h.globals.cybexoGtmConsentUpdate,callback);assert.equal(h.pending.length,1);assert.deepEqual(h.calls.filter(c=>c[0]==='update').at(-1),['update',denied]);
 h.pending[0].success();assert.equal(callback(granted),false);h.run();assert.deepEqual(outcomes(h),loaded?[['success',1],['success',2],['failure',3],['failure',4]]:[['failure',1],['failure',2],['failure',3],['failure',4]]);
});
for(const settingsId of ['', '  ',null,undefined,123])test('empty invalid identity establishes denial and fails: '+settingsId,()=>{
 const h=setup();h.run({settingsId,globalDefaultsJson:JSON.stringify(granted)});assert.deepEqual(h.calls[1][1],{...denied,wait_for_update:500});assert.deepEqual(outcomes(h),[['failure',1]]);assert.equal(h.pending.length,0);
});
test('callback collision denies without overwriting any prior owner',()=>{
 const h=setup({collision:true});const callback=h.globals.cybexoGtmConsentUpdate;h.run({globalDefaultsJson:JSON.stringify(granted)});assert.equal(h.globals.cybexoGtmConsentUpdate,callback);assert.deepEqual(h.calls.filter(c=>c[0]==='update'),[['update',denied]]);assert.equal(h.pending.length,0);assert.deepEqual(outcomes(h),[['failure',1]]);
});
test('valid partial defaults fill unspecified keys with denied',()=>{
 const h=setup();h.run({globalDefaultsJson:'{"analytics_storage":"granted"}'});assert.deepEqual(h.calls[1][1],{...denied,analytics_storage:'granted',wait_for_update:500});
});
test('region defaults inherit absent keys; explicit invalid values deny',()=>{
 const h=setup();h.run({globalDefaultsJson:JSON.stringify(granted),regionList:'DE, fr, DE',regionDefaultsJson:'{"analytics_storage":"denied","ad_storage":"bad"}',waitForUpdateMs:750});assert.deepEqual(h.calls.filter(c=>c[0]==='default').map(c=>c[1]),[{...granted,wait_for_update:750},{...granted,analytics_storage:'denied',ad_storage:'denied',region:['DE','FR'],wait_for_update:750}]);
});
for(const input of ['{"ad_storage":"granted",}',500,null,'[{"ad_storage":"granted"}]','{"nested":{"ad_storage":"granted"}}'])test('invalid or nested global input stays fully denied: '+input,()=>{
 const h=setup();h.run({globalDefaultsJson:input});assert.deepEqual(h.calls[1][1],{...denied,wait_for_update:500});
});
test('malformed regional JSON cannot inherit configured global grants',()=>{const h=setup();h.run({globalDefaultsJson:JSON.stringify(granted),regionList:'DE',regionDefaultsJson:'{"ad_storage":"granted",}'});assert.deepEqual(h.calls.filter(c=>c[0]==='default').at(-1)[1],{...denied,region:['DE'],wait_for_update:500});});
test('absent optional regional values inherit global values without type crashes',()=>{for(const regionDefaultsJson of ['',undefined,null]){const h=setup();h.run({globalDefaultsJson:JSON.stringify(granted),regionList:'US-CA',regionDefaultsJson});assert.deepEqual(h.calls.filter(c=>c[0]==='default').at(-1)[1],{...granted,region:['US-CA'],wait_for_update:500});}for(const regionList of [null,undefined,500,{}]){const h=setup();h.run({regionList});assert.equal(h.pending.length,1);}});
test('wait is finite and bounded; permitted values are retained',()=>{
 for(const wait of [0,100,'x',NaN,Infinity,-Infinity,10001,null,undefined,'']){const h=setup();h.run({waitForUpdateMs:wait});assert.equal(h.calls[1][1].wait_for_update,500);}
 for(const wait of [500,750,10000,'750']){const h=setup();h.run({waitForUpdateMs:wait});assert.equal(h.calls[1][1].wait_for_update,Number(wait));}
});
test('valid generated CYB identities retain exact value and fixed endpoints',()=>{
 for(const id of ['CYB-kwol0d503y','CYB-0000000000','CYB-zzzzzzzzzz']){const h=setup();h.run({settingsId:' '+id+' '});const url=new URL(h.calls.find(c=>c[0]==='inject')[1]);assert.equal(url.searchParams.get('data-settings-id'),id);assert.equal(url.searchParams.get('data-assets-url'),'https://cmp.cybexo.com/releases/1.5.40-23fc15424d75');assert.equal(url.searchParams.get('data-cdn-url'),'https://edge.cybexo.com');}
});
for(const id of ['NXG-kwol0d503y','NXG-ASCEND-S11-WEB-EN','CYB-','CYB-fixture','CYB-01234567890','CYB-012345678A','cyb-0123456789','CYB-01234-6789','CYB-0123456789&data-assets-url=https://evil.test/','CYB-01234/6789','CYB-01234é6789'])test('retired or malformed identity denies without injection: '+id,()=>{
 const h=setup();h.run({settingsId:id,globalDefaultsJson:JSON.stringify(granted)});assert.deepEqual(h.calls.find(c=>c[0]==='default')[1],{...denied,wait_for_update:500});assert.deepEqual(h.calls.filter(c=>c[0]==='update'),[['update',denied]]);assert.equal(h.pending.length,0);assert.ok(!h.calls.some(c=>c[0]==='register'));assert.deepEqual(outcomes(h),[['failure',1]]);
 if(id.startsWith('NXG-'))assert.ok(h.calls.some(c=>c[0]==='log'&&c[1].includes('Migrate the app')&&c[1].includes('do not rename the prefix')));
});
test('NXG trigger cannot replace or revive existing valid CYB ownership',()=>{const h=setup();h.run();h.pending[0].success();h.globals.cybexoGtmConsentUpdate(granted);const callback=h.globals.cybexoGtmConsentUpdate;h.run({settingsId:'NXG-fixture001'});assert.equal(h.globals.cybexoGtmConsentUpdate,callback);assert.equal(h.pending.length,1);assert.equal(callback(granted),false);assert.deepEqual(h.calls.filter(c=>c[0]==='update').at(-1),['update',denied]);});
test('absent empty and unserializable consent input never parses undefined',()=>{
 for(const value of [undefined,null,'','  \n']){const h=setup();h.run({globalDefaultsJson:value});h.globals.cybexoGtmConsentUpdate(value);assert.deepEqual(h.parseInputs,[]);assert.deepEqual(h.calls.filter(c=>c[0]==='update').at(-1),['update',denied]);}
 const h=setup();h.run();const cyclic={};cyclic.self=cyclic;h.globals.cybexoGtmConsentUpdate(cyclic);assert.deepEqual(h.parseInputs,[]);
});
test('fields and permissions expose only necessary endpoints and APIs',()=>{
 const params=JSON.parse(part('TEMPLATE_PARAMETERS'));assert.deepEqual(params.map(p=>p.name),['settingsId','globalDefaultsJson','regionList','regionDefaultsJson','waitForUpdateMs']);
 const permissions=JSON.parse(part('WEB_PERMISSIONS'));const byId=id=>permissions.find(p=>p.instance.key.publicId===id).instance;
 assert.deepEqual(byId('inject_script').param[0].value.listItem.map(x=>x.string),['https://cmp.cybexo.com/releases/1.5.40-23fc15424d75/loader.js*']);
 for(const item of byId('access_consent').param[0].value.listItem)assert.deepEqual(item.mapValue.slice(1).map(x=>x.boolean),[false,true]);
 const access=byId('access_globals').param[0].value.listItem;assert.equal(access.length,5);assert.equal(access[0].mapValue[0].string,'cybexoGtmConsentUpdate');assert.deepEqual(access[0].mapValue.slice(1).map(x=>x.boolean),[true,true,false]);
 assert.ok(code.includes("require('callInWindow')"));assert.ok(code.includes("require('callLater')"));assert.ok(code.includes("require('updateConsentState')"));
});
