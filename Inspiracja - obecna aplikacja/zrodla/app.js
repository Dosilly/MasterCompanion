const $=s=>document.querySelector(s);
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('ł','l');
const pageMap=new Map(DATA.pages.map(p=>[p.id,p]));
const docMap=new Map(DATA.docs.map(d=>[d.id,d]));
const searchData=DATA.pages.map(p=>({p,title:norm(p.title),text:norm(p.text)}));
let chapter=6,current=null,query='',openDocs=new Set();
let mapMode=false,mapChapter=null,mapZoom=1;
const mapViews=new Map();
function storageGet(key){try{return localStorage.getItem(key)}catch{return null}}
function storageSet(key,value){try{localStorage.setItem(key,value)}catch{}}
if(storageGet('icewind-theme')==='dark')document.body.classList.add('dark');
function closeMenu(){document.body.classList.remove('nav-open');$('#menu').setAttribute('aria-expanded','false');$('#backdrop').hidden=true;}
function label(title){const m=title.match(/^([HY]\d+[a-z]?)\.\s*(.*)$/i);return m?`<span class="loc-code">${esc(m[1])}</span> ${esc(m[2])}`:esc(title);}
function noteGroup(d){return d.path.includes('/Metadane/')?'metadata':d.path.includes('/Wątki Graczy/')?'players':'campaign';}
function renderToc(){
 $('#map-link').href='#map-'+chapter;
 $('#map-link').textContent='◇ Mapa — '+DATA.maps[chapter].title;
 if(mapMode)$('#map-link').setAttribute('aria-current','page');else $('#map-link').removeAttribute('aria-current');
 document.querySelectorAll('[data-chapter]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.chapter)===chapter)));
 if(query){
  const words=norm(query).split(/\s+/).filter(Boolean);
  const results=searchData.filter(({title,text})=>words.every(w=>(title+' '+text).includes(w))).sort((a,b)=>Number(b.title.includes(norm(query)))-Number(a.title.includes(norm(query))));
  $('#toc').innerHTML=`<div class="search-count" role="status">Wyniki: ${results.length} · oba rozdziały</div>`+(results.length?results.map(({p,text})=>{
   const at=text.indexOf(words[0]);const start=Math.max(0,at-55);const snippet=p.text.slice(start,start+155);
   const d=docMap.get(p.doc),group=noteGroup(d);
   return `<a class="search-result" href="#${p.id}"${p.id===current?.id?' aria-current="page"':''}><strong>${label(p.title)}</strong><small>Rozdział ${p.chapter} · ${group==='metadata'?'Materiały redakcyjne · ':group==='players'?'Wątki graczy · ':''}${esc(d.title)}</small><p>${start?'…':''}${esc(snippet)}…</p></a>`;
  }).join(''):'<p class="empty">Brak wyników. Spróbuj nazwy lokacji, np. H33, albo krótszej frazy.</p>');
  $('#nav-meta').textContent='Esc — wyczyść wyszukiwanie';return;
 }
 const docs=DATA.docs.filter(d=>d.chapter===chapter);
 const documentItem=d=>`<details data-doc="${d.id}"${openDocs.has(d.id)||d.id===current?.doc?' open':''}><summary>${esc(d.name.replace(/^\d+[a-z]?\.\s*/,''))}</summary><div class="subnav">${d.pages.map((p,i)=>`<a href="#${p.id}"${p.id===current?.id?' aria-current="page"':''}>${i===0?'Przegląd notatki':label(p.title)}</a>`).join('')}</div></details>`;
 const group=(key,title,items,body)=>items.length?`<details class="toc-group" data-doc="${key}"${openDocs.has(key)||items.some(d=>d.id===current?.doc)?' open':''}><summary>${title}</summary><div class="toc-children">${body??items.map(documentItem).join('')}</div></details>`:'';
 const playerDocs=docs.filter(d=>noteGroup(d)==='players');
 const fenesDocs=playerDocs.filter(d=>d.path.includes('/Fenes/'));
 const playerBody=playerDocs.filter(d=>!fenesDocs.includes(d)).map(documentItem).join('')+group('fenes','Fenes',fenesDocs);
 $('#toc').innerHTML=docs.filter(d=>noteGroup(d)==='campaign').map(documentItem).join('')+group('players','Wątki graczy',playerDocs,playerBody)+group('metadata','Materiały redakcyjne',docs.filter(d=>noteGroup(d)==='metadata'));
 $('#toc').querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)openDocs.add(d.dataset.doc);else openDocs.delete(d.dataset.doc)}));
 $('#nav-meta').textContent=`${docs.length} notatek · ${docs.reduce((n,d)=>n+d.pages.length,0)} sekcji · dostępne offline`;
}
function markMatches(){
 if(!query)return;
 const words=norm(query).split(/\s+/).filter(Boolean);const walker=document.createTreeWalker($('#content'),NodeFilter.SHOW_TEXT);const nodes=[];
 while(walker.nextNode())if(!walker.currentNode.parentElement.closest('script,style,mark'))nodes.push(walker.currentNode);
 for(const node of nodes){
  const value=node.nodeValue;const normalized=norm(value);const ranges=[];
  for(const word of words){let i=0;while((i=normalized.indexOf(word,i))>=0){ranges.push([i,i+word.length]);i+=word.length;}}
  if(!ranges.length)continue;ranges.sort((a,b)=>a[0]-b[0]);const fragment=document.createDocumentFragment();let end=0;
  for(const [a,b] of ranges){if(a<end)continue;fragment.append(value.slice(end,a));const mark=document.createElement('mark');mark.textContent=value.slice(a,b);fragment.append(mark);end=b;}
  fragment.append(value.slice(end));let parent=node.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement}node.replaceWith(fragment);
 }
}
function renderPage(){
 const parts=location.hash.slice(1).split('~');
 const toolsMode=parts[0]==='tools-7';
 $('#tracker-panel').hidden=!toolsMode;
 if(toolsMode)$('#tools-link').setAttribute('aria-current','page');else $('#tools-link').removeAttribute('aria-current');
 if(toolsMode){mapMode=false;chapter=7;current=null;$('#map-panel').hidden=true;$('#note-panel').hidden=true;$('#source').hidden=true;$('#breadcrumb').textContent='Rozdział 7 / Narzędzia sesji';document.title='Narzędzia Ythryn · Icewind Dale';TrackerUI.render();renderToc();closeMenu();storageSet('icewind-last','tools-7');window.scrollTo(0,0);$('#reading').focus({preventScroll:true});return;}
 mapMode=/^map-[67]$/.test(parts[0]);
 const requested=mapMode?parts[1]:parts[0],anchor=mapMode?parts[2]:parts[1];
 const mapNumber=mapMode?Number(parts[0].slice(-1)):null;
 const selected=pageMap.get(requested);
 const p=selected&&(!mapMode||selected.chapter===mapNumber)?selected:mapMode?DATA.pages.find(p=>p.chapter===mapNumber):DATA.pages[0];current=p;chapter=p.chapter;
 $('#map-panel').hidden=!mapMode;
 $('#note-panel').hidden=mapMode&&!selected;
 $('#map-note-tools').hidden=!mapMode;
 $('#standalone-note').href='#'+p.id;
 $('#source').hidden=mapMode&&!selected;
 if(mapMode)renderMap(mapNumber,selected?.chapter===mapNumber?p:null);
 const doc=docMap.get(p.doc);
 $('#chapter-label').textContent=p.chapter===6?'Rozdział 06 / Jaskinie Głodu':'Rozdział 07 / Zagłada Ythryn';
 $('#breadcrumb').textContent=`Rozdział ${p.chapter} / ${doc.name.replace(/^\d+[a-z]?\.\s*/,'')}`;
 $('#page-title').textContent=p.title;$('#page-title').dataset.page=p.id;
 $('#source').href=p.sourceLink;$('#source').title=p.source;
 $('#content').innerHTML=p.html;
 const inTower=mapMode&&p.source.endsWith('04. Iglica Iriolarthasa Y19a-Y19q.md');
 $('#tower-rooms').hidden=!inTower;
 $('#tower-rooms').innerHTML=inTower?'<strong>Komnaty iglicy</strong><div>'+DATA.pages.filter(r=>r.doc===p.doc&&/^Y19[a-q]\./.test(r.title)).map(r=>`<a href="#${r.id}" title="${esc(r.title)}"${r.id===p.id?' aria-current="page"':''}>${r.title.split('.')[0]}</a>`).join('')+'</div>':'';
 const sections=[...$('#content').querySelectorAll('h3[id],details.context[id]')];
 $('#section-nav').innerHTML=sections.slice(0,12).map(h=>`<a href="#${p.id}~${h.id}">${esc(h.matches('details')?h.querySelector('summary').textContent:h.textContent)}</a>`).join('');
 const list=DATA.pages.filter(x=>x.chapter===p.chapter&&noteGroup(docMap.get(x.doc))===noteGroup(doc));const i=list.findIndex(x=>x.id===p.id);
 for(const [selector,other,arrow] of [['#prev',list[i-1],'←'],['#next',list[i+1],'→']]){
  const a=$(selector);a.hidden=!other;if(other){a.href='#'+other.id;a.textContent=selector==='#prev'?`${arrow} ${other.title}`:`${other.title} ${arrow}`;}
 }
 document.title=(mapMode&&!selected?'Mapa — '+DATA.maps[mapNumber].title:p.title)+' · Icewind Dale';storageSet('icewind-last',location.hash.slice(1)||p.id);renderToc();markMatches();closeMenu();
 if(anchor){const target=document.getElementById(anchor);if(target){let e=target;while(e){if(e.tagName==='DETAILS')e.open=true;e=e.parentElement;}target.scrollIntoView();}else (mapMode?$('#note-panel'):$('#reading')).scrollIntoView();}
 else if(mapMode&&selected)$('#note-panel').scrollIntoView();else window.scrollTo(0,0);
 if(mapMode&&selected){$('#page-title').tabIndex=-1;$('#page-title').focus({preventScroll:true});}else $('#reading').focus({preventScroll:true});
}
function sizeMap(){
 if(mapChapter===null)return;
 $('#map-stage').style.width=($('#map-viewport').clientWidth*mapZoom)+'px';
 $('#zoom-value').textContent=Math.round(mapZoom*100)+'%';
 $('#zoom-out').disabled=mapZoom<=.1;
 $('#zoom-in').disabled=mapZoom>=4;
}
function zoomMap(value){
 const view=$('#map-viewport'),oldWidth=$('#map-stage').offsetWidth;
 const centerX=(view.scrollLeft+view.clientWidth/2-Math.max(0,(view.clientWidth-oldWidth)/2))/oldWidth;
 const centerY=(view.scrollTop+view.clientHeight/2)/oldWidth;
 mapZoom=Math.max(.1,Math.min(4,value));sizeMap();
 const width=$('#map-stage').offsetWidth;
 view.scrollLeft=centerX*width+Math.max(0,(view.clientWidth-width)/2)-view.clientWidth/2;view.scrollTop=centerY*width-view.clientHeight/2;
}
function renderMap(number,selected){
 const map=DATA.maps[number];
 if(mapChapter!==number){
  const view=$('#map-viewport');
  if(mapChapter!==null)mapViews.set(mapChapter,{zoom:mapZoom,x:view.scrollLeft,y:view.scrollTop});
  mapChapter=number;mapZoom=mapViews.get(number)?.zoom||1;
  $('#map-title').textContent=map.title;
  $('#map-credit').href=map.source;
  $('#map-image').src=map.image;$('#map-image').alt='Mapa: '+map.title;
  $('#map-stage').style.aspectRatio=map.width+' / '+map.height;
  $('#map-markers').innerHTML=map.points.map((point,i)=>`<button class="map-pin" data-page="${point.page}" data-code="${point.code}" style="left:${point.x}%;top:${point.y}%" aria-label="${esc(point.title)}${map.points.filter(p=>p.code===point.code).length>1?' — miejsce '+(map.points.slice(0,i).filter(p=>p.code===point.code).length+1):''}" title="${esc(point.title)}" aria-pressed="false">${point.code}</button>`).join('');
  const unique=[...new Map(map.points.map(p=>[p.code,p])).values()].sort((a,b)=>a.code.localeCompare(b.code,'pl',{numeric:true}));
  $('#map-location').innerHTML='<option value="">Wybierz lokację…</option>'+unique.map(p=>`<option value="${p.page}">${esc(p.code==='Y19'?'Y19. Iglica Iriolarthasa':p.title)}</option>`).join('');
  sizeMap();view.scrollLeft=mapViews.get(number)?.x||0;view.scrollTop=mapViews.get(number)?.y||0;
 }
 const tower=selected?.source.endsWith('04. Iglica Iriolarthasa Y19a-Y19q.md');
 const selectedPoint=map.points.find(p=>p.page===selected?.id||(tower&&p.code==='Y19'));
 $('#map-markers').querySelectorAll('button').forEach(pin=>pin.setAttribute('aria-pressed',String(pin.dataset.code===selectedPoint?.code)));
 $('#map-location').value=selectedPoint?.page||'';
 $('#map-status').textContent=selected?'Otwarta notatka: '+selected.title:new Set(map.points.map(p=>p.code)).size+' lokacji · wybierz oznaczenie na mapie lub lokację z listy.';
}
$('#map-markers').addEventListener('click',e=>{const pin=e.target.closest('button[data-page]');if(!pin)return;const hash='#map-'+mapChapter+'~'+pin.dataset.page;if(location.hash===hash)renderPage();else location.hash=hash;});
$('#map-location').addEventListener('change',e=>{if(e.target.value)location.hash='#map-'+mapChapter+'~'+e.target.value;});
$('#zoom-in').addEventListener('click',()=>zoomMap(mapZoom*1.3));
$('#zoom-out').addEventListener('click',()=>zoomMap(mapZoom/1.3));
$('#zoom-fit').addEventListener('click',()=>{const map=DATA.maps[mapChapter],view=$('#map-viewport');zoomMap(Math.min(1,view.clientHeight/(view.clientWidth*map.height/map.width)));view.scrollLeft=0;view.scrollTop=0;});
$('#return-map').addEventListener('click',()=>{$('#map-panel').scrollIntoView();$('#map-viewport').focus({preventScroll:true});});
new ResizeObserver(()=>{if(mapMode)sizeMap()}).observe($('#map-viewport'));
let mapDrag=null;
$('#map-viewport').addEventListener('pointerdown',e=>{if(e.button!==0||e.pointerType==='touch'||e.target.closest('button'))return;mapDrag={x:e.clientX,y:e.clientY,left:e.currentTarget.scrollLeft,top:e.currentTarget.scrollTop};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.classList.add('dragging');e.preventDefault();});
$('#map-viewport').addEventListener('pointermove',e=>{if(!mapDrag)return;e.currentTarget.scrollLeft=mapDrag.left+mapDrag.x-e.clientX;e.currentTarget.scrollTop=mapDrag.top+mapDrag.y-e.clientY;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('#map-viewport').addEventListener(event,e=>{mapDrag=null;e.currentTarget.classList.remove('dragging')});
$('#map-image').addEventListener('dragstart',e=>e.preventDefault());
$('#search').addEventListener('input',e=>{query=e.target.value.trim();renderToc()});
$('#search').addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();e.target.value='';query='';renderToc();}if(e.key==='Enter'){$('#toc .search-result')?.click();}});
document.querySelectorAll('[data-chapter]').forEach(b=>b.addEventListener('click',()=>{chapter=Number(b.dataset.chapter);query='';$('#search').value='';location.hash=mapMode?'map-'+chapter:DATA.docs.find(d=>d.chapter===chapter).id;renderToc();}));
$('#theme').addEventListener('click',()=>{document.body.classList.toggle('dark');storageSet('icewind-theme',document.body.classList.contains('dark')?'dark':'light')});
$('#menu').addEventListener('click',()=>{const open=document.body.classList.toggle('nav-open');$('#menu').setAttribute('aria-expanded',String(open));$('#backdrop').hidden=!open;if(open)$('#search').focus();});
$('#backdrop').addEventListener('click',closeMenu);
document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();if(matchMedia('(max-width:760px)').matches){document.body.classList.add('nav-open');$('#menu').setAttribute('aria-expanded','true');$('#backdrop').hidden=false;}$('#search').focus()}if(e.key==='Escape')closeMenu()});
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#s"]');if(!a||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;if(mapMode&&a.id!=='standalone-note'){const id=a.hash.slice(1).split('~')[0],page=pageMap.get(id);if(page){e.preventDefault();const hash='#map-'+page.chapter+'~'+a.hash.slice(1);if(hash===location.hash)renderPage();else location.hash=hash;return;}}if(a.hash===location.hash){e.preventDefault();renderPage();}});
window.addEventListener('hashchange',renderPage);
const last=storageGet('icewind-last');
if(!location.hash&&last&&(last==='tools-7'||pageMap.has(last.split('~')[0])||/^map-[67](~s[\da-f]+)?(~s[\da-f]+)?$/.test(last)))history.replaceState(null,'','#'+last);
TrackerUI.setup();
renderPage();
