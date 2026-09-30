const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const T=require('./tracker-core.js');
let count=0;
function test(name,fn){fn();count++;console.log('OK '+name)}
const advance=(s,minutes,explore=false)=>T.reduce(s,{type:'time',minutes,explore});
const rest=(s,minutes=480)=>T.reduce(s,{type:'rest',minutes});
const roll=(s,pass,die,player=0)=>T.reduce(s,{type:'blight',pass,die,player});
test('Initial five players match campaign; hunger and exhaustion do not invent facts',()=>{
 const s=T.fresh();assert.deepEqual(s.players.map(p=>p.name),['Fenes','Tillo','Ellemar','Harkan','Hugo']);assert.equal(s.time,0);assert.equal(s.players.filter(p=>p.hunger).length,2);assert.equal(s.players[1].exhaustion,null);assert.equal(s.players[1].hungerNext,null);assert.equal(T.due(s,s.players[0]),null);
});
test('Exposure is due at exactly 12 hours; success does not lower DC',()=>{
 let s=advance(T.fresh(),719);assert.equal(T.due(s,s.players[0]),null);s=advance(s,1);assert.equal(T.due(s,s.players[0]).type,'exposure');s=roll(s,true);assert.equal(s.players[0].dc,15);assert.equal(s.players[0].exposureSuccess,1);assert.equal(s.players[0].success,0);assert.equal(s.players[0].nextExposure,1440);
});
test('Exposure failure infects but does not count toward transformation',()=>{
 let s=roll(advance(T.fresh(),720),false);assert.equal(s.players[0].status,'infected');assert.equal(s.players[0].fail,0);assert.equal(T.due(s,s.players[0]),null);s=advance(s,720);assert.equal(T.due(s,s.players[0]),null);
});
test('Recovery success requires a real d6 and persists reduced DC',()=>{
 let s=rest(roll(advance(T.fresh(),720),false));assert.throws(()=>roll(s,true,0));assert.throws(()=>roll(s,true,7));assert.throws(()=>roll(s,true,1.5));s=roll(s,true,4);assert.equal(s.players[0].dc,11);assert.equal(s.players[0].success,1);assert.equal(T.due(s,s.players[0]),null);assert.throws(()=>roll(s,true,4));
});
test('Three recovery failures, not the infection, transform the character',()=>{
 let s=roll(advance(T.fresh(),720),false);for(let i=1;i<=3;i++){s=roll(rest(s),false);assert.equal(s.players[0].fail,i);assert.equal(s.players[0].status,i===3?'nothic':'infected');}assert.equal(T.due(rest(s),s.players[0]),null);assert.throws(()=>T.reduce(s,{type:'heal',player:0}));
});
test('DC zero cures and gives immunity; no more exposure or rest rolls',()=>{
 let s=roll(advance(T.fresh(),720),false);for(const n of [6,6,3])s=roll(rest(s),true,n);assert.equal(s.players[0].status,'immune');assert.equal(s.players[0].dc,0);s=rest(advance(s,1440));assert.equal(T.due(s,s.players[0]),null);
});
test('Magical treatment resets infection but grants no immunity',()=>{
 let s=roll(advance(T.fresh(),720),false);s=T.reduce(s,{type:'heal',player:0});assert.equal(s.players[0].status,'healthy');assert.equal(s.players[0].nextExposure,1440);s=advance(s,720);assert.equal(T.due(s,s.players[0]).type,'exposure');
});
test('Exposure during a rest is resolved before that rest recovery check',()=>{
 let s=rest(advance(T.fresh(),600));assert.equal(s.time,1080);s=roll(s,false);assert.equal(T.due(s,s.players[0]).type,'recovery');assert.equal(T.due(s,s.players[0]).at,1080);
});
test('Long time jumps preserve overdue exposure checks and all rest rolls',()=>{
 let s=advance(T.fresh(),2160);s=roll(s,true);assert.equal(T.due(s,s.players[0]).at,1440);s=roll(s,true);assert.equal(T.due(s,s.players[0]).at,2160);s=roll(s,false);s=rest(rest(s));s=roll(s,false);assert.equal(T.due(s,s.players[0]).type,'recovery');s=roll(s,true,2);assert.equal(T.due(s,s.players[0]),null);
});
test('Rest does not generate exploration encounters; buildings and patrols are separate',()=>{
 let s=advance(T.fresh(),30,true);s=rest(s);assert.equal(T.encounters(s),0);s=T.reduce(s,{type:'building'});assert.equal(T.encounters(s),1);assert.equal(s.buildingChecks,1);assert.equal(s.patrolChecks,0);s=T.reduce(s,{type:'factions',entry:1440,delay:0,avarice:'arrived',auril:'waiting'});s=T.reduce(s,{type:'new-building'});assert.equal(s.patrolChecks,1);s=T.reduce(s,{type:'encounter'});assert.equal(T.encounters(s),0);assert.throws(()=>T.reduce(s,{type:'encounter'}));
});
test('Hunger requires known exhaustion and retains overdue hourly checks',()=>{
 let s=T.reduce(T.fresh(),{type:'hunger-check',player:1});assert.throws(()=>T.reduce(s,{type:'hunger-fail',player:1}));s=T.reduce(s,{type:'exhaustion',player:1,value:2});s=T.reduce(s,{type:'hunger-fail',player:1});assert.equal(s.players[1].exhaustion,3);assert.equal(s.players[1].hungerNext,60);s=advance(s,121);assert.throws(()=>T.reduce(s,{type:'feed',player:1}));s=T.reduce(s,{type:'hunger-fail',player:1});assert.equal(s.players[1].hungerNext,120);s=T.reduce(s,{type:'hunger-pass',player:1});assert.equal(s.players[1].hunger,false);assert.equal(s.players[1].exhaustion,4);
});
test('Food gives exactly one hour of relief',()=>{
 let s=T.reduce(T.fresh(),{type:'feed',player:4});assert.equal(s.players[4].hungerNext,60);s=advance(s,60);s=T.reduce(s,{type:'feed',player:4});assert.equal(s.players[4].hungerNext,120);
});
test('Existing hunger relief can be entered without pretending a meal happened now',()=>{
 const s=T.reduce(T.fresh(),{type:'hunger-time',player:1,minutes:25});assert.equal(s.players[1].hungerNext,25);assert.throws(()=>T.reduce(s,{type:'hunger-time',player:1,minutes:61}));
});
test('Repeated custom timers retain overdue occurrences',()=>{
 let s=T.reduce(T.fresh(),{type:'timer',name:'Pościg',minutes:60,repeat:true});assert.throws(()=>T.reduce(s,{type:'timer-done',id:1}));s=advance(s,180);s=T.reduce(s,{type:'timer-done',id:1});assert.equal(s.timers[0].at,120);assert.equal(s.timers[0].done,false);
});
test('Independent players, tower clues, challenges and personal ritual',()=>{
 let s=roll(advance(T.fresh(),720),false);s=roll(s,true,undefined,1);assert.equal(s.players[0].status,'infected');assert.equal(s.players[1].status,'healthy');s=T.reduce(s,{type:'tower',code:'Y11',field:'clue',value:true});assert.equal(s.towers.Y11.cleared,false);s=T.reduce(s,{type:'ritual',player:2,value:true});assert.equal(s.players[2].ritual,true);assert.equal(s.players[1].ritual,false);
});
test('Serialization, immutable updates, malformed imports and duplicate rests',()=>{
 const initial=T.fresh();const changed=advance(initial,60);assert.equal(initial.time,0);assert.deepEqual(T.validate(JSON.parse(JSON.stringify(changed))),changed);assert.throws(()=>T.validate({version:999}));const bad=T.fresh();bad.players[0].dc=-2;assert.throws(()=>T.validate(bad));const s=rest(T.fresh(),0);assert.throws(()=>rest(s,0));assert.throws(()=>advance(s,-1));assert.throws(()=>advance(s,NaN));
});
test('Static UI rendering, save/load, undo and exploration preference',()=>{
 const elements=new Map();const events={};let html='',saved=null;
 const input={checked:true};const feedback={textContent:''};
 const host={get innerHTML(){return html},set innerHTML(v){html=v;elements.set('#track-explore',input)},querySelector(s){return elements.get(s)||null},querySelectorAll(){return []},addEventListener(name,fn){events[name]=fn}};
 const context=vm.createContext({console,DATA:{pages:[]},document:{querySelector(s){return s==='#tracker-panel'?host:s==='#tracker-feedback'?feedback:elements.get(s)||null}},localStorage:{getItem(){return null},setItem(k,v){saved=JSON.parse(v)}},confirm:()=>true});
 vm.runInContext(fs.readFileSync(__dirname+'/tracker-core.js','utf8')+'\n'+fs.readFileSync(__dirname+'/tracker-ui.js','utf8')+'\nTrackerUI.setup();TrackerUI.render();',context);
 for(const name of T.names)assert.ok(html.includes(name));
 const click=dataset=>events.click({target:{closest(){return {dataset}}}});
 input.checked=false;click({track:'advance',minutes:'60'});assert.equal(saved.state.time,60);assert.equal(saved.state.exploration,0);assert.equal(input.checked,false);
 click({track:'undo'});assert.equal(saved.state.time,0);
 assert.ok(html.includes('Wpisz czas od otwarcia lodowca'));
});
console.log(`${count} tests passed.`);
