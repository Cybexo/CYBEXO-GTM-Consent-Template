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
function setup({collision=false,failLoader=false}={}){
 const calls=[],store=new Map(),globals=collision?{cybexoGtmConsentUpdate:()=>{}}:{};
 const apis={
  logToConsole:(...a)=>calls.push(['log',...a]),
  injectScript:(url,success,failure,token)=>{calls.push(['injectScript',url,token]);(failLoader?failure:success)();},
  gtagSet:(...a)=>calls.push(['gtagSet',...a]),
  setDefaultConsentState:s=>calls.push(['default',clone(s)]),
  updateConsentState:s=>calls.push(['update',clone(s)]),
  setInWindow:(key,fn,override)=>{calls.push(['register',key,override]);if(globals[key]&&!override)return false;globals[key]=fn;return true;},
  templateStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},
  JSON:{parse:s=>{try{return JSON.parse(s);}catch{return undefined;}}},encodeUriComponent:encodeURIComponent
 };
 const run=(data={})=>vm.runInNewContext(code,{require:k=>{assert.ok(k in apis,k);return apis[k];},data:{settingsId:'fixture',regionList:'',waitForUpdateMs:500,gtmOnSuccess:()=>calls.push(['success']),gtmOnFailure:()=>calls.push(['failure']),...data}});
 return {calls,globals,run};
}
test('denied defaults and locked developer ID precede callback and loader',()=>{
 const h=setup();h.run({developerId:'override',loaderUrl:'https://evil.test/'});
 assert.deepEqual(h.calls.map(c=>c[0]),['gtagSet','default','register','injectScript','success']);
 assert.deepEqual(h.calls[0],['gtagSet','developer_id.dZTNmYW',true]);
 assert.deepEqual(h.calls[1][1],{...denied,wait_for_update:500});
 const url=new URL(h.calls[3][1]);assert.equal(url.origin,'https://cmp.cybexo.com');assert.equal(url.searchParams.get('data-consent-mode'),'off');assert.equal(url.searchParams.get('data-developer-id'),'dZTNmYW');
});
test('accept granular analytics-off and withdrawal use native updates',()=>{
 const h=setup();h.run();for(const s of [granted,{...granted,ad_user_data:'denied'},{...granted,analytics_storage:'denied'},denied])assert.equal(h.globals.cybexoGtmConsentUpdate(s),true);
 assert.deepEqual(h.calls.filter(c=>c[0]==='update').map(c=>c[1]),[granted,{...granted,ad_user_data:'denied'},{...granted,analytics_storage:'denied'},denied]);
});
for(const input of [null,{},'malformed',{analytics_storage:'granted'},{ad_storage:true,analytics_storage:'GRANTED'}])test('missing or malformed fields never retain an earlier grant: '+JSON.stringify(input),()=>{
 const h=setup();h.run();h.globals.cybexoGtmConsentUpdate(granted);h.globals.cybexoGtmConsentUpdate(input);
 assert.deepEqual(h.calls.at(-1)[1],input?.analytics_storage==='granted'?{...denied,analytics_storage:'granted'}:denied);
});
test('extra callback fields cannot change scope or developer ID',()=>{
 const h=setup();h.run();h.globals.cybexoGtmConsentUpdate({...granted,region:['US'],wait_for_update:99999,developer_id:'evil',security_storage:'granted'});assert.deepEqual(h.calls.at(-1),['update',granted]);
});
test('repeated execution neither resets consent nor duplicates injection',()=>{
 const h=setup();h.run();h.globals.cybexoGtmConsentUpdate(granted);const count=h.calls.length;h.run();assert.deepEqual(h.calls.slice(count),[['success']]);
});
test('conflicting Settings ID does not replace the active owner',()=>{
 const h=setup();h.run();const cb=h.globals.cybexoGtmConsentUpdate;h.run({settingsId:'other'});assert.equal(h.globals.cybexoGtmConsentUpdate,cb);assert.equal(h.calls.at(-1)[0],'failure');assert.equal(h.calls.filter(c=>c[0]==='injectScript').length,1);
});
test('missing identity is denied even with configured grants',()=>{
 const h=setup();h.run({settingsId:'  ',globalDefaultsJson:JSON.stringify(granted)});assert.deepEqual(h.calls[1][1],{...denied,wait_for_update:500});assert.equal(h.calls.at(-1)[0],'failure');assert.ok(!h.calls.some(c=>c[0]==='injectScript'));
});
test('callback collision denies and fails without overwriting another callback',()=>{
 const h=setup({collision:true});const cb=h.globals.cybexoGtmConsentUpdate;h.run();assert.equal(h.globals.cybexoGtmConsentUpdate,cb);assert.ok(h.calls.some(c=>c[0]==='update'&&JSON.stringify(c[1])===JSON.stringify(denied)));assert.ok(!h.calls.some(c=>c[0]==='injectScript'));
});
test('script delivery failure revokes defaults and reports failure',()=>{
 const h=setup({failLoader:true});h.run({globalDefaultsJson:JSON.stringify(granted)});assert.deepEqual(h.calls.filter(c=>c[0]==='update'),[['update',denied]]);assert.equal(h.calls.at(-1)[0],'failure');assert.ok(!h.calls.some(c=>c[0]==='success'));
});
test('region override inherits missing keys and deduplicates region codes',()=>{
 const h=setup();h.run({globalDefaultsJson:'{"analytics_storage":"granted"}',regionList:'DE, fr, DE',regionDefaultsJson:'{"analytics_storage":"denied"}',waitForUpdateMs:750});assert.deepEqual(h.calls.filter(c=>c[0]==='default').map(c=>c[1]),[{...denied,analytics_storage:'granted',wait_for_update:750},{...denied,region:['DE','FR'],wait_for_update:750}]);
});
for(const input of ['{"ad_storage":"granted",}',500,null])test('invalid defaults are fully denied: '+input,()=>{
 const h=setup();h.run({globalDefaultsJson:input});assert.deepEqual(h.calls[1][1],{...denied,wait_for_update:500});
});
test('wait is bounded and settings ID is URL encoded',()=>{
 for(const wait of [0,100,'x',Infinity,10001]){const h=setup();h.run({waitForUpdateMs:wait,settingsId:'test&data-assets-url=evil'});assert.equal(h.calls[1][1].wait_for_update,500);const u=new URL(h.calls.find(c=>c[0]==='injectScript')[1]);assert.equal(u.searchParams.get('data-assets-url'),'https://cmp.cybexo.com');assert.equal(u.searchParams.get('data-settings-id'),'test&data-assets-url=evil');}
});
test('fields and permissions cannot expose endpoint or attribution overrides',()=>{
 const params=JSON.parse(part('TEMPLATE_PARAMETERS'));assert.deepEqual(params.map(p=>p.name),['settingsId','globalDefaultsJson','regionList','regionDefaultsJson','waitForUpdateMs']);
 const permissions=JSON.parse(part('WEB_PERMISSIONS'));const globals=permissions.find(p=>p.instance.key.publicId==='access_globals');assert.ok(JSON.stringify(globals).includes('cybexoGtmConsentUpdate')); const access=globals.instance.param[0].value.listItem[0]; assert.deepEqual(access.mapValue.slice(1).map(v=>v.boolean),[true,true,false]);assert.ok(!code.includes("require('callInWindow')"));assert.ok(code.includes("require('updateConsentState')"));
});

test('repeated execution after failed delivery does not claim success',()=>{const h=setup({failLoader:true});h.run();const count=h.calls.length;h.run();assert.equal(h.calls.at(-1)[0],'failure');assert.ok(!h.calls.slice(count).some(c=>c[0]==='success'));});
