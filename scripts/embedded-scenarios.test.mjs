import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const template=readFileSync(new URL('../template.tpl',import.meta.url),'utf8');
const section=name=>template.split('___'+name+'___')[1].split('\n___')[0];
const code=section('SANDBOXED_JS_FOR_WEB_TEMPLATE');
const scenarios=[...section('TESTS').matchAll(/^- name: (.+)\n  code: \|-\n([\s\S]*?)(?=^- name: |$(?![\s\S]))/gm)];
const clone=value=>JSON.parse(JSON.stringify(value));
test('embedded Gallery scenario extraction is complete',()=>assert.equal(scenarios.length,11));
for(const [,name,body] of scenarios)test('embedded: '+name,()=>{
 const calls=new Map(),mocks={};
 const apis={JSON:{parse:text=>{try{return JSON.parse(text);}catch{return undefined;}},stringify:value=>{try{return JSON.stringify(value);}catch{return undefined;}}},getType:v=>v===null?'null':Array.isArray(v)?'array':typeof v,encodeUriComponent:encodeURIComponent};
 const api=(name,...args)=>{calls.set(name,[...(calls.get(name)||[]),args]);return (mocks[name]||apis[name]||(()=>{}))(...args);};
 const context={
  mock:(name,fn)=>{mocks[name]=fn;},mockObject:(name,object)=>{apis[name]=object;},
  runCode:data=>vm.runInNewContext(code,{require:name=>typeof apis[name]==='object'?apis[name]:(...args)=>api(name,...args),data:{gtmOnSuccess:()=>api('gtmOnSuccess'),gtmOnFailure:()=>api('gtmOnFailure'),...data}}),
  assertApi:name=>({wasCalled:()=>assert.ok(calls.get(name)?.length,name+' was called'),wasNotCalled:()=>assert.equal(calls.get(name)?.length||0,0,name+' was not called'),wasCalledWith:(...args)=>assert.ok(calls.get(name)?.some(actual=>{try{assert.deepEqual(clone(actual),clone(args));return true;}catch{return false;}}),name+' expected arguments')}),
  assertThat:value=>({isEqualTo:expected=>assert.deepEqual(value,expected),isTrue:()=>assert.equal(value,true),isFalse:()=>assert.equal(value,false)})
 };
 vm.runInNewContext(body.split('\n').map(line=>line.startsWith('    ')?line.slice(4):line).join('\n'),context);
});
