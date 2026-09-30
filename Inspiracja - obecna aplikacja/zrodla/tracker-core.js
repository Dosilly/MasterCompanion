/* Pure campaign-state logic; shared by the offline UI and its tests. */
const YthrynTracker = (()=>{
 const names=['Fenes','Tillo','Ellemar','Harkan','Hugo'];
 const towers=['Y4','Y7','Y11','Y24','Y20','Y22','Y18','Y26'];
 const fresh=()=>({version:1,time:0,exploration:0,encountersDone:0,buildings:0,buildingChecks:0,patrolChecks:0,rests:[],sequence:0,entry:null,avariceDelay:0,avarice:'waiting',auril:'waiting',timers:[],notes:'',towers:Object.fromEntries(towers.map(t=>[t,{clue:false,cleared:false}])),players:names.map((name,id)=>({id,name,status:'healthy',dc:15,success:0,fail:0,exposureSuccess:0,exposureFail:0,nextExposure:720,infectedAt:null,resolvedRests:[],ritual:false,hunger:['Tillo','Hugo'].includes(name),hungerNext:null,exhaustion:null})),log:[]});
 const number=(v,min=0,max=100000000)=>Number.isInteger(v)&&v>=min&&v<=max;
 function validate(s){
  if(!s||s.version!==1||!number(s.time)||!number(s.exploration)||s.exploration>s.time||!number(s.sequence)||!Array.isArray(s.players)||s.players.length!==5)throw Error('Nieprawidłowy plik stanu Ythryn.');
  for(const k of ['encountersDone','buildings','buildingChecks','patrolChecks','avariceDelay'])if(!number(s[k]))throw Error('Nieprawidłowy licznik: '+k);
  if(s.encountersDone>Math.floor(s.exploration/60)||s.buildingChecks>s.buildings)throw Error('Niespójne liczniki spotkań.');
  if(s.entry!==null&&!number(s.entry))throw Error('Nieprawidłowy czas wejścia.');
  for(const k of ['avarice','auril'])if(!['waiting','arrived','disabled'].includes(s[k]))throw Error('Nieprawidłowy stan frakcji.');
  if(!Array.isArray(s.rests)||!Array.isArray(s.timers)||!Array.isArray(s.log)||typeof s.notes!=='string'||s.notes.length>30000)throw Error('Nieprawidłowe dane dodatkowe.');
  if(s.rests.length>5000||s.timers.length>500||s.log.length>200)throw Error('Plik przekracza limit liczników.');
  for(const [i,p] of s.players.entries()){
   if(p.id!==i||p.name!==names[i]||!['healthy','infected','immune','nothic'].includes(p.status)||!number(p.dc,0,100)||!number(p.fail,0,3)||!number(p.success)||!number(p.exposureSuccess)||!number(p.exposureFail)||!Array.isArray(p.resolvedRests))throw Error('Nieprawidłowa karta postaci.');
   for(const k of ['nextExposure','infectedAt','hungerNext','exhaustion'])if(p[k]!==null&&!number(p[k],0,k==='exhaustion'?6:100000000))throw Error('Nieprawidłowy licznik postaci.');
   if(typeof p.hunger!=='boolean'||typeof p.ritual!=='boolean'||p.resolvedRests.some(x=>!number(x)))throw Error('Nieprawidłowy stan postaci.');
   if(p.status==='healthy'&&p.nextExposure===null||p.status==='infected'&&(p.infectedAt===null||p.dc<1||p.fail>=3)||p.status==='immune'&&p.dc!==0||p.status==='nothic'&&p.fail!==3)throw Error('Niespójny stan zarazy.');
  }
  for(const t of towers)if(typeof s.towers?.[t]?.clue!=='boolean'||typeof s.towers?.[t]?.cleared!=='boolean')throw Error('Nieprawidłowy postęp wież.');
  for(const [i,r] of s.rests.entries())if(!number(r.id)||!number(r.at)||r.at>s.time||(i&&r.at<=s.rests[i-1].at))throw Error('Nieprawidłowy odpoczynek.');
  if(new Set(s.rests.map(r=>r.id)).size!==s.rests.length)throw Error('Powtórzony odpoczynek.');
  for(const p of s.players)if(p.resolvedRests.some(id=>!s.rests.some(r=>r.id===id)))throw Error('Brak zapisanego odpoczynku.');
  for(const t of s.timers)if(!number(t.id)||!number(t.at)||!number(t.repeat,0,100800)||typeof t.name!=='string'||t.name.length>160||typeof t.done!=='boolean')throw Error('Nieprawidłowe przypomnienie.');
  if([...s.rests,...s.timers].some(item=>item.id>s.sequence))throw Error('Niespójna kolejność zdarzeń.');
  for(const l of s.log)if(!number(l.at)||typeof l.text!=='string'||l.text.length>2000)throw Error('Nieprawidłowy dziennik.');
  return s;
 }
 const restDue=(s,p)=>p.status==='infected'?s.rests.find(r=>r.at>=p.infectedAt&&!p.resolvedRests.includes(r.id)):null;
 const due=(s,p)=>p.status==='healthy'&&s.time>=p.nextExposure?{type:'exposure',at:p.nextExposure}:restDue(s,p)?{type:'recovery',...restDue(s,p)}:null;
 const encounters=s=>Math.max(0,Math.floor(s.exploration/60)-s.encountersDone);
 function apply(s,a){
  const p=s.players[a.player];let text='';
  switch(a.type){
   case 'time':case 'building':case 'rest':{
    const minutes=a.type==='building'?30:a.minutes;
    if(!number(minutes,0,10080)||a.type==='time'&&minutes===0)throw Error('Wpisz od 1 do 10080 minut.');
    s.time+=minutes;
    if(a.explore||a.type==='building')s.exploration+=minutes;
    if(a.type==='building'){s.buildings++;s.buildingChecks++;if(s.avarice==='arrived')s.patrolChecks++;}
    if(a.type==='rest'){if(s.rests.some(r=>r.at===s.time))throw Error('Odpoczynek o tej godzinie został już zapisany.');s.rests.push({id:++s.sequence,at:s.time});}
    text=a.type==='rest'?'Koniec długiego odpoczynku całej drużyny':a.type==='building'?'Przeszukanie budynku: +30 min, spotkanie i skarb':'Upływ czasu: +'+minutes+' min'+(a.explore?' eksploracji':'');break;
   }
   case 'blight':{
    if(!p)throw Error('Brak postaci.');const roll=due(s,p);if(!roll)throw Error('Ta postać nie ma oczekującego rzutu.');
    if(typeof a.pass!=='boolean')throw Error('Wybierz wynik rzutu.');
    if(roll.type==='exposure'){
     if(a.pass){p.exposureSuccess++;p.nextExposure=roll.at+720;}
     else{p.exposureFail++;p.status='infected';p.infectedAt=roll.at;p.nextExposure=null;p.dc=15;p.success=0;p.fail=0;p.resolvedRests=[];}
    }else{
     if(a.pass){if(!number(a.die,1,6))throw Error('Wpisz wynik k6: od 1 do 6.');p.success++;p.dc=Math.max(0,p.dc-a.die);if(p.dc===0)p.status='immune';}
     else{p.fail++;if(p.fail===3)p.status='nothic';}
     p.resolvedRests.push(roll.id);
    }
    text=p.name+': '+(roll.type==='exposure'?'ekspozycja':'zaraza po odpoczynku')+' — '+(a.pass?'sukces':'porażka')+(roll.type==='recovery'&&a.pass?' (k6: '+a.die+', ST '+p.dc+')':'');break;
   }
   case 'heal':if(!p||p.status!=='infected')throw Error('Leczenie dotyczy zarażonej postaci przed przemianą.');p.status='healthy';p.nextExposure=s.time+720;p.infectedAt=null;p.dc=15;p.fail=0;p.success=0;p.resolvedRests=[];text=p.name+': leczenie magiczne; nowa ekspozycja za 12 h, bez odporności';break;
   case 'player-edit':{
    if(!p||!number(a.dc,0,100)||!number(a.success)||!number(a.fail,0,3)||!['healthy','infected','immune','nothic'].includes(a.status))throw Error('Sprawdź stan i liczniki postaci.');
    Object.assign(p,{status:a.status,dc:a.dc,success:a.success,fail:a.fail,infectedAt:a.status==='infected'?s.time:null,nextExposure:a.status==='healthy'?s.time+720:null,resolvedRests:s.rests.map(r=>r.id)});
    if(p.status==='immune')p.dc=0;if(p.status==='nothic')p.fail=3;
    if(p.status==='infected'&&(p.dc<1||p.fail>=3))throw Error('Zarażony musi mieć ST powyżej 0 i mniej niż 3 porażki.');
    text=p.name+': ręczna korekta liczników; terminy liczone od teraz';break;
   }
   case 'feed':if(!p?.hunger)throw Error('Brak aktywnej klątwy głodu.');if(p.hungerNext!==null&&p.hungerNext<s.time)throw Error('Najpierw rozstrzygnij zaległe rzuty głodu lub cofnij czas do posiłku.');p.hungerNext=s.time+60;text=p.name+': porcja jedzenia, godzina ulgi';break;
   case 'hunger-time':if(!p?.hunger||!number(a.minutes,0,60))throw Error('Wpisz pozostałą ulgę od 0 do 60 minut.');p.hungerNext=s.time+a.minutes;text=p.name+': ręcznie ustawiono pozostałą ulgę od głodu na '+a.minutes+' min';break;
   case 'hunger-check':if(!p?.hunger)throw Error('Brak aktywnej klątwy głodu.');p.hungerNext=s.time;text=p.name+': rzut na głód do rozstrzygnięcia teraz';break;
   case 'hunger-pass':if(!p?.hunger)throw Error('Brak aktywnej klątwy głodu.');p.hunger=false;p.hungerNext=null;text=p.name+': koniec klątwy głodu i odporność na H12; wyczerpanie pozostaje';break;
   case 'hunger-fail':if(!p?.hunger||p.hungerNext===null||p.hungerNext>s.time)throw Error('Najpierw ustaw termin rzutu na głód.');if(p.exhaustion===null)throw Error('Najpierw wpisz obecny poziom wyczerpania.');p.exhaustion=Math.min(6,p.exhaustion+1);p.hungerNext+=60;text=p.name+': porażka przeciw głodowi; +1 wyczerpania';break;
   case 'exhaustion':if(!p||!number(a.value,0,6))throw Error('Wpisz poziom wyczerpania 0–6.');p.exhaustion=a.value;text=p.name+': wyczerpanie '+a.value;break;
   case 'encounter':if(encounters(s)<1)throw Error('Brak zaległego spotkania godzinowego.');s.encountersDone++;text='Rozliczono godzinowe spotkanie losowe';break;
   case 'building-check':if(s.buildingChecks<1)throw Error('Brak przeszukania do rozliczenia.');s.buildingChecks--;text='Rozliczono spotkanie i skarb z przeszukania';break;
   case 'patrol':if(s.patrolChecks<1)throw Error('Brak patrolu do sprawdzenia.');s.patrolChecks--;text='Rozliczono sprawdzenie patrolu Avarice (20%)';break;
   case 'new-building':if(s.avarice==='arrived')s.patrolChecks++;text='Nowy budynek (bez dodawania czasu)';break;
   case 'factions':if(a.entry!==null&&!number(a.entry)||!number(a.delay))throw Error('Podaj nieujemny czas w minutach.');s.entry=a.entry;s.avariceDelay=a.delay;s.avarice=a.avarice;s.auril=a.auril;text='Zaktualizowano zegary Avarice i Auril';break;
   case 'tower':if(!towers.includes(a.code)||!['clue','cleared'].includes(a.field)||typeof a.value!=='boolean')throw Error('Nieprawidłowa wieża.');s.towers[a.code][a.field]=a.value;text=a.code+': zmiana postępu';break;
   case 'ritual':if(!p||typeof a.value!=='boolean')throw Error('Nieprawidłowa postać.');p.ritual=a.value;text=p.name+': '+(a.value?'rytuał wykonany':'rytuał nieukończony');break;
   case 'timer':if(typeof a.name!=='string'||!a.name.trim()||a.name.length>160||!number(a.minutes,1,100800))throw Error('Podaj nazwę i dodatni czas przypomnienia.');s.timers.push({id:++s.sequence,name:a.name.trim(),at:s.time+a.minutes,repeat:a.repeat?a.minutes:0,done:false});text='Przypomnienie: '+a.name;break;
   case 'timer-done':{const t=s.timers.find(t=>t.id===a.id);if(!t)throw Error('Brak przypomnienia.');if(t.at>s.time)throw Error('Termin jeszcze nie nadszedł.');if(t.repeat)t.at+=t.repeat;else t.done=true;text='Rozliczono: '+t.name;break;}
   case 'notes':if(typeof a.text!=='string'||a.text.length>30000)throw Error('Notatka jest zbyt długa.');s.notes=a.text;text='Zapisano notatkę sesji';break;
   default:throw Error('Nieznana czynność.');
  }
  s.log.unshift({at:s.time,text});s.log=s.log.slice(0,100);validate(s);return s;
 }
 function reduce(s,a){return apply(JSON.parse(JSON.stringify(s)),a);}
 return {fresh,validate,due,encounters,reduce,towers,names};
})();
if(typeof module!=='undefined')module.exports=YthrynTracker;
