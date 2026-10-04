/* O Púlpito · aba Programação do palco */
(function(){
'use strict';
const C=window.PFCore;
const $=id=>document.getElementById(id);
let sess=null,P=null,cfg=null,editing=null,lastLive=null,client=null,comments={v:1,list:[],del:[]},pubTimer=0,lastRows='';
const DEF_CFG={acao:'perguntar',aviso:5,rolar:true,duck:true,lastDur:30};
const K=()=> 'pf.prog.'+sess.slug, KC=()=> 'pf.cfg.'+sess.slug, KL=()=> 'pf.live.'+sess.slug;

/* ---------------- arquivos (IndexedDB) ---------------- */
let dbp=null;
function idb(){
  if(dbp)return dbp;
  dbp=new Promise((res,rej)=>{const r=indexedDB.open('pf-files',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
  return dbp;
}
async function fput(k,blob){const d=await idb();return new Promise((res,rej)=>{const t=d.transaction('files','readwrite');t.objectStore('files').put(blob,k);t.oncomplete=res;t.onerror=()=>rej(t.error)})}
async function fget(k){const d=await idb();return new Promise((res,rej)=>{const r=d.transaction('files').objectStore('files').get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function fdel(k){const d=await idb();return new Promise(res=>{const t=d.transaction('files','readwrite');t.objectStore('files').delete(k);t.oncomplete=res;t.onerror=res})}
const urlCache={};
async function urlOf(a){
  if(a.url)return a.url;
  if(urlCache[a.id])return urlCache[a.id];
  const b=await fget(sess.slug+':'+a.id);if(!b)throw new Error('arquivo não encontrado neste computador');
  return urlCache[a.id]=URL.createObjectURL(b);
}

/* ---------------- dados ---------------- */
function hoje(){const d=new Date();return d.getFullYear()+'-'+C.pad(d.getMonth()+1)+'-'+C.pad(d.getDate())}
function exemplo(){
  const n=Math.floor(C.nowMin()),r=m=>{const x=Math.round((n+m)/5)*5;return C.fmt(((x%1440)+1440)%1440)};
  const it=(h,t,x)=>({id:C.uid(8),hora:h,dur:'',titulo:t,texto:x||'',estado:'auto'});
  return {id:C.uid(8),titulo:'Culto de domingo',data:hoje(),exemplo:true,anexos:{},pub:null,
    items:[it(r(-40),'Acolhida','Boas-vindas na porta e avisos rápidos.'),
           it(r(-15),'Momento musical','Louvor com a banda. Anexe a letra com @ ou arraste um arquivo aqui.'),
           it(r(5),'Leitura bíblica','Salmo 23'),
           it(r(30),'Pregação','Mensagem principal.'),
           it(r(75),'Encerramento','Oração final e avisos.')]};
}
function load(){
  try{P=JSON.parse(localStorage.getItem(K()))}catch(e){P=null}
  if(!P||!Array.isArray(P.items))P=exemplo();
  P.anexos=P.anexos||{};
  try{cfg=Object.assign({},DEF_CFG,JSON.parse(localStorage.getItem(KC())||'{}'))}catch(e){cfg=Object.assign({},DEF_CFG)}
}
function save(){
  try{localStorage.setItem(K(),JSON.stringify(P))}catch(e){toast('Não deu para salvar (espaço cheio?)')}
  schedulePublish();
}
function saveCfg(){try{localStorage.setItem(KC(),JSON.stringify(cfg))}catch(e){}}
const toast=m=>{try{window.PF&&PF.toast?PF.toast(m):console.log(m)}catch(e){}};
const byName=()=>C.byName(P.anexos);
function uniqueName(n){
  n=C.cleanName(n);const has=x=>Object.values(P.anexos).some(a=>a.nome.toLowerCase()===x.toLowerCase());
  if(!has(n))return n;let i=2;while(has(n+i))i++;return n+i;
}

/* ---------------- montagem ---------------- */
function mount(){
  const host=$('panel-prog');
  host.innerHTML=`
  <div class="pg-wrap" id="pgWrap">
    <header class="pg-head">
      <div class="pg-titles">
        <input class="pg-title" id="pgTitle" aria-label="Título da programação" maxlength="80">
        <div class="pg-sub"><input type="date" id="pgDate" aria-label="Data"><span class="pg-church" id="pgChurch"></span></div>
      </div>
      <div class="pg-clock" aria-live="off"><span>AGORA</span><b id="pgNow">--:--</b></div>
      <div class="pg-actions">
        <button class="pg-btn primary" id="pgAdd" type="button">+ ITEM</button>
        <button class="pg-btn" id="pgAttach" type="button">ANEXAR</button>
        <div class="pg-menu-wrap"><button class="pg-btn" id="pgExportBtn" type="button" aria-haspopup="menu" aria-expanded="false">EXPORTAR ▾</button>
          <div class="pg-menu" id="pgExportMenu" role="menu" hidden>
            <div class="pg-menu-h">IMAGEM</div>
            <button role="menuitem" data-x="pdf">PDF</button><button role="menuitem" data-x="jpeg">JPEG</button>
            <div class="pg-menu-h">SITE</div>
            <button role="menuitem" data-x="site">Site · só a programação, passando sozinha</button>
            <button role="menuitem" data-x="edit">Site editável · com comentários e arquivos</button>
          </div></div>
      </div>
    </header>
    <div class="pg-banner" id="pgExample" hidden>Esta é uma programação de <b>exemplo</b>, com horários perto de agora. Edite à vontade ou <button type="button" id="pgNew">comece uma nova</button>.</div>
    <div class="pg-legend" aria-label="Legenda">
      ${['noar','prestes','agendado','passou','ignorado'].map(k=>`<span><i class="pg-dot st-${k}"></i>${C.STATES[k].label}</span>`).join('')}
    </div>
    <div class="pg-body">
      <main class="pg-list" id="pgList" aria-label="Itens da programação"></main>
      <aside class="pg-side">
        <section class="pg-box" id="pgPlayer" hidden>
          <h3>TOCANDO</h3>
          <div class="pg-pl"><b id="pgPlName">—</b><audio id="pgAudio" controls preload="auto"></audio>
          <button class="pg-btn sm" id="pgPlStop" type="button">PARAR</button></div>
        </section>
        <section class="pg-box pg-lib" id="pgLibBox">
          <h3>ANEXOS <span id="pgLibN">0</span></h3>
          <div id="pgLib" class="pg-lib-list"></div>
          <div class="pg-drophint">Arraste arquivos para qualquer lugar desta aba, ou digite <b>@</b> no texto de um item.</div>
          <div class="pg-lib-add"><button class="pg-btn sm" id="pgAddLink" type="button">+ LINK DO CANVA</button><button class="pg-btn sm" id="pgAddText" type="button">+ TEXTO</button></div>
        </section>
        <section class="pg-box" id="pgPubBox" hidden>
          <h3>PUBLICADO</h3><div id="pgPubInfo"></div>
        </section>
        <section class="pg-box" id="pgCmtBox" hidden>
          <h3>COMENTÁRIOS <span id="pgCmtN">0</span></h3><div id="pgCmts" class="pg-cmts"></div>
        </section>
      </aside>
    </div>
    <div class="pg-drop" id="pgDrop" aria-hidden="true"><div>Solte para anexar<small id="pgDropT">à biblioteca</small></div></div>
    <div class="pg-ac" id="pgAc" role="listbox" hidden></div>
    <input type="file" id="pgFile" multiple hidden>
  </div>`;
  // media no palco do slide
  const area=document.querySelector('#panel-slide .sl-area');
  if(area&&!$('pfMedia')){const m=document.createElement('div');m.id='pfMedia';m.className='pf-media';m.hidden=true;area.appendChild(m)}
  wire();
}

/* ---------------- render ---------------- */
function render(){
  $('pgTitle').value=P.titulo||'';$('pgDate').value=P.data||'';
  $('pgChurch').textContent=sess.nome;
  $('pgExample').hidden=!P.exemplo;
  const list=$('pgList');
  const items=C.sorted(P.items);
  const bn=byName();
  list.innerHTML=items.map(it=>it.id===editing?editHTML(it):rowHTML(it,bn)).join('')+
    `<button class="pg-addrow" type="button" id="pgAdd2">+ adicionar item</button><div class="pg-now" id="pgNowLine" hidden><span id="pgNowLbl"></span></div>`;
  $('pgAdd2').onclick=addItem;
  renderLib();renderPub();renderComments();
  tick(true);
  if(editing){const f=list.querySelector('.pg-edit [name=titulo]');if(f&&!f.value)f.focus()}
}
function rowHTML(it,bn){
  const an=C.mentions(it.texto).map(n=>bn[n]).filter(Boolean);
  return `<article class="pg-item" data-id="${it.id}" tabindex="0" aria-label="${C.esc((it.hora||'sem hora')+' '+it.titulo)}">
    <div class="pg-time"><b>${C.esc(it.hora||'--:--')}</b><small class="pg-until"></small></div>
    <div class="pg-rail"><span class="pg-dot"></span></div>
    <div class="pg-card">
      <div class="pg-top"><h4>${C.esc(it.titulo||'(sem título)')}</h4>
        <button type="button" class="pg-tool" data-act="ign">${it.estado==='ignorado'?'REATIVAR':'IGNORAR'}</button>
        <button type="button" class="pg-tool" data-act="edit">EDITAR</button><span class="pg-badge"></span></div>
      ${it.texto?`<div class="pg-text">${C.renderText(it.texto,bn)}</div>`:''}
      <div class="pg-bar"><i></i></div>
      ${an.length?`<div class="pg-tools">${an.slice(0,4).map(a=>`<button type="button" class="pg-use" data-use="${a.id}" title="Usar agora no palco">▶ ${C.esc(a.nome)}</button>`).join('')}</div>`:''}
    </div></article>`;
}
function editHTML(it){
  return `<article class="pg-item editing" data-id="${it.id}">
    <div class="pg-time"><input type="time" name="hora" value="${C.esc(it.hora)}" aria-label="Horário"></div>
    <div class="pg-rail"><span class="pg-dot"></span></div>
    <form class="pg-card pg-edit" autocomplete="off">
      <input name="titulo" value="${C.esc(it.titulo)}" placeholder="Título (ex.: Momento musical, Culto, Pregação)" aria-label="Título" maxlength="80">
      <div class="pg-ta-wrap"><textarea name="texto" rows="3" placeholder="O que vai acontecer… digite @ para anexar slide, imagem, vídeo, música ou texto" aria-label="Descrição">${C.esc(it.texto)}</textarea></div>
      <div class="pg-edit-row">
        <label>Duração <input type="number" name="dur" min="0" max="600" value="${C.esc(it.dur)}" placeholder="auto"> min</label>
        <span class="pg-sp"></span>
        <button type="button" class="pg-tool danger" data-act="del">EXCLUIR</button>
        <button type="button" class="pg-tool" data-act="ign">${it.estado==='ignorado'?'REATIVAR':'IGNORAR'}</button>
        <button type="submit" class="pg-btn primary sm">CONCLUIR</button>
      </div>
    </form></article>`;
}
function renderLib(){
  const arr=Object.values(P.anexos).sort((a,b)=>a.nome.localeCompare(b.nome));
  $('pgLibN').textContent=arr.length;
  $('pgLib').innerHTML=arr.length?arr.map(a=>`<div class="pg-lib-it k-${a.kind}">
      <button type="button" class="pf-chip k-${a.kind}" data-anexo="${a.id}">${C.icon(a.kind)}@${C.esc(a.nome)}</button>
      <small>${C.esc(C.KIND_LABEL[a.kind]||'')} ${C.size(a.size)}</small>
      <button type="button" class="pg-mini" data-use="${a.id}" title="Usar agora" aria-label="Usar @${C.esc(a.nome)} agora">▶</button>
    </div>`).join(''):'<div class="pg-empty">Nenhum anexo ainda.</div>';
}

/* estados / linha do agora: roda a cada 10 s sem refazer a lista */
function tick(force){
  if(!P)return;
  const st=C.compute(P.items,{aviso:cfg.aviso,lastDur:cfg.lastDur});
  $('pgNow').textContent=C.fmt(Math.floor(st.now));
  document.querySelectorAll('#pgList .pg-item').forEach(el=>{
    const s=st.map[el.dataset.id];if(!s)return;
    el.className=el.className.replace(/\bst-\w+/g,'').trim()+' st-'+s.state;
    const b=el.querySelector('.pg-badge');
    if(b){
      let t='';
      if(s.state==='noar')t='NO AR · faltam '+Math.max(1,Math.ceil(s.end-st.now))+' min';
      else if(s.state==='prestes')t='EM '+Math.max(1,Math.ceil(s.inMin))+' MIN';
      else if(s.state==='ignorado')t='IGNORADO';
      else if(s.state==='passou')t='FEITO';
      b.textContent=t;
    }
    const u=el.querySelector('.pg-until');if(u)u.textContent=s.end!=null?'até '+C.fmt(s.end):'';
    const bar=el.querySelector('.pg-bar i');if(bar)bar.style.width=Math.round(s.progress*100)+'%';
  });
  // linha do "agora" entre os itens
  const line=$('pgNowLine');
  if(line){
    const items=C.sorted(P.items).filter(i=>C.toMin(i.hora)!=null);
    const els=items.map(i=>document.querySelector('#pgList .pg-item[data-id="'+i.id+'"]'));
    let top=null;
    for(let i=0;i<items.length;i++){
      const a=C.toMin(items[i].hora),b=i+1<items.length?C.toMin(items[i+1].hora):st.map[items[i].id].end;
      if(st.now>=a&&st.now<b&&els[i]){
        const y1=els[i].offsetTop+12,y2=i+1<items.length&&els[i+1]?els[i+1].offsetTop+12:els[i].offsetTop+els[i].offsetHeight;
        top=y1+(y2-y1)*((st.now-a)/Math.max(1e-6,b-a));break;
      }
    }
    if(top==null&&items.length&&els[0]&&st.now<C.toMin(items[0].hora))top=els[0].offsetTop-6;
    line.hidden=top==null;if(top!=null){line.style.top=top+'px';$('pgNowLbl').textContent='agora '+C.fmt(Math.floor(st.now))}
  }
  // aba
  const tab=$('tab-prog'),meta=$('tsProgMeta');
  if(tab){tab.classList.toggle('pg-live',!!st.live);tab.classList.toggle('pg-soon',!st.live&&!!st.next&&st.map[st.next.id].state==='prestes')}
  if(meta)meta.textContent=st.live?st.live.titulo:(st.next?'próx. '+st.next.hora:'—');
  // auto-rolagem até o item no ar
  if(cfg.rolar&&st.live&&!editing&&document.body.classList.contains('tab-prog')&&(force||st.live.id!==tick._lastScroll)){
    const el=document.querySelector('#pgList .pg-item[data-id="'+st.live.id+'"]');
    if(el&&!force){el.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
    tick._lastScroll=st.live.id;
  }
  // entrou no ar?
  const liveId=st.live?st.live.id:null;
  if(liveId!==lastLive){
    const prev=lastLive;lastLive=liveId;
    let stored=null;try{stored=localStorage.getItem(KL())}catch(e){}
    if(liveId&&stored!==hoje()+':'+liveId){
      try{localStorage.setItem(KL(),hoje()+':'+liveId)}catch(e){}
      if(prev!==undefined)onLive(st.live);
    }
  }
}
lastLive=undefined;

/* ---------------- ação ao entrar no ar ---------------- */
function anexosDo(it){const bn=byName();return C.mentions(it.texto).map(n=>bn[n]).filter(Boolean)}
const PALCO=['canva','imagem','video','pdf','texto'];
function onLive(it){
  const an=anexosDo(it);
  toast('NO AR: '+(it.titulo||'item'));
  if(cfg.acao==='nada'||!an.length)return;
  if(cfg.acao==='auto'){
    const vis=an.find(a=>PALCO.includes(a.kind)),mus=an.find(a=>a.kind==='musica');
    if(vis)use(vis);if(mus)use(mus);
    return;
  }
  // perguntar
  let b=$('pgAsk');if(b)b.remove();
  b=document.createElement('div');b.id='pgAsk';b.className='pg-ask';b.setAttribute('role','alertdialog');b.setAttribute('aria-label','Item no ar');
  b.innerHTML=`<span class="pg-dot st-noar"></span><div class="pg-ask-t"><small>NO AR AGORA</small><b>${C.esc(it.titulo)}</b></div>
    ${an.slice(0,3).map(a=>`<button type="button" class="pg-btn sm primary" data-use="${a.id}">${C.icon(a.kind)} USAR @${C.esc(a.nome)}</button>`).join('')}
    <button type="button" class="pg-btn sm" data-close>AGORA NÃO</button>`;
  document.body.appendChild(b);
  b.addEventListener('click',e=>{const u=e.target.closest('[data-use]');if(u)use(P.anexos[u.dataset.use]);if(u||e.target.closest('[data-close]'))b.remove()});
  setTimeout(()=>{if(b.isConnected)b.remove()},60000);
}

/* ---------------- usar anexo no palco ---------------- */
async function use(a){
  if(!a)return;
  try{
    if(a.kind==='canva'){await PF.openCanva(a.url);closeMedia(true);return}
    if(a.kind==='link'){window.open(a.url,'_blank','noopener');return}
    if(a.kind==='musica'){playAudio(a);return}
    if(PALCO.includes(a.kind)){showMedia(a);return}
    const u=await urlOf(a);window.open(u,'_blank');
  }catch(e){toast(String(e.message||e))}
}
async function showMedia(a){
  const m=$('pfMedia');if(!m)return;
  let inner='';
  if(a.kind==='texto')inner=`<div class="pf-media-text">${C.esc(a.texto||'').replace(/\n/g,'<br>')}</div>`;
  else{
    const u=await urlOf(a);
    if(a.kind==='imagem')inner=`<img src="${u}" alt="${C.esc(a.nome)}">`;
    else if(a.kind==='video')inner=`<video src="${u}" controls autoplay playsinline></video>`;
    else if(a.kind==='pdf')inner=`<iframe src="${u}#toolbar=0&view=Fit" title="${C.esc(a.nome)}"></iframe>`;
  }
  m.innerHTML=inner+`<span class="pf-media-tag">${C.icon(a.kind)}@${C.esc(a.nome)}</span><button type="button" class="pf-media-x" aria-label="Fechar mídia">×</button>`;
  m.querySelector('.pf-media-x').onclick=()=>closeMedia();
  m.hidden=false;document.body.classList.add('pf-media-on');
  PF.setTab('slide');PF.refreshBar&&PF.refreshBar();
  const pg=$('slPage');if(pg)pg.textContent='@'+a.nome;
}
function closeMedia(silent){
  const m=$('pfMedia');if(!m||m.hidden)return;
  const v=m.querySelector('video');if(v)v.pause();
  m.hidden=true;m.innerHTML='';document.body.classList.remove('pf-media-on');
  PF.refreshBar&&PF.refreshBar();
}
let pgDucked=false;
async function playAudio(a){
  const au=$('pgAudio');
  au.src=await urlOf(a);$('pgPlName').textContent='@'+a.nome;$('pgPlayer').hidden=false;
  if(cfg.duck&&typeof window.setDuck==='function'&&!(PF.isDucked&&PF.isDucked())){window.setDuck(true);pgDucked=true}
  try{await au.play()}catch(e){toast('Clique em ▶ no player para tocar')}
}
function stopAudio(){
  const au=$('pgAudio');au.pause();au.removeAttribute('src');au.load();$('pgPlayer').hidden=true;
  if(pgDucked&&typeof window.setDuck==='function'){window.setDuck(false)}pgDucked=false;
}

/* ---------------- edição ---------------- */
function addItem(){
  const items=C.sorted(P.items),lastT=items.length?C.toMin(items[items.length-1].hora):null;
  const h=lastT!=null?C.fmt(lastT+15):C.fmt(Math.ceil(C.nowMin()/5)*5);
  const it={id:C.uid(8),hora:h,dur:'',titulo:'',texto:'',estado:'auto'};
  P.items.push(it);P.exemplo=false;editing=it.id;save();render();
}
function commitEdit(el){
  const it=P.items.find(i=>i.id===el.dataset.id);if(!it)return;
  it.hora=el.querySelector('[name=hora]').value||it.hora;
  it.titulo=el.querySelector('[name=titulo]').value.trim();
  it.texto=el.querySelector('[name=texto]').value;
  const d=el.querySelector('[name=dur]').value;it.dur=d&&+d>0?String(Math.round(+d)):'';
  P.exemplo=false;
}
function finishEdit(){
  const el=document.querySelector('#pgList .pg-item.editing');if(el)commitEdit(el);
  editing=null;hideAc();save();render();
}

/* ---------------- @ autocompletar ---------------- */
let ac={ta:null,start:0,sel:0,opts:[]};
function acCheck(ta){
  const v=ta.value.slice(0,ta.selectionStart);
  const m=/(^|\s)@([\p{L}\p{N}_-]*)$/u.exec(v);
  if(!m){hideAc();return}
  const q=m[2].toLowerCase();
  const arr=Object.values(P.anexos).filter(a=>a.nome.toLowerCase().startsWith(q)||a.nome.toLowerCase().includes(q)).slice(0,6);
  ac={ta,start:ta.selectionStart-m[2].length-1,sel:0,opts:[
    ...arr.map(a=>({t:'a',a})),
    {t:'file',label:'Anexar arquivo (slide, imagem, vídeo, música)…'},
    {t:'link',label:'Link do Canva…'},
    {t:'text',label:'Texto (letra, versículo)…'}
  ]};
  drawAc();
}
function drawAc(){
  const box=$('pgAc'),ta=ac.ta;if(!ta)return;
  box.innerHTML=ac.opts.map((o,i)=>`<div role="option" class="pg-ac-it${i===ac.sel?' on':''}" data-i="${i}" aria-selected="${i===ac.sel}">${o.t==='a'?C.icon(o.a.kind)+'<b>@'+C.esc(o.a.nome)+'</b><small>'+C.esc(C.KIND_LABEL[o.a.kind]||'')+'</small>':'<span class="pg-ac-plus">+</span>'+C.esc(o.label)}</div>`).join('');
  const r=ta.getBoundingClientRect(),w=$('pgWrap').getBoundingClientRect();
  box.style.left=(r.left-w.left)+'px';box.style.top=(r.bottom-w.top+$('pgWrap').scrollTop+4)+'px';box.style.width=Math.min(360,r.width)+'px';
  box.hidden=false;
}
function hideAc(){const b=$('pgAc');if(b)b.hidden=true;ac.ta=null}
async function acPick(i){
  const o=ac.opts[i],ta=ac.ta;if(!o||!ta)return;
  const start=ac.start,end=ta.selectionStart;hideAc();
  let a=null;
  if(o.t==='a')a=o.a;
  else if(o.t==='file'){const fs=await pickFiles();for(const f of fs){const x=await addFile(f);if(x){a=x;break}}}
  else if(o.t==='link')a=await addLink();
  else if(o.t==='text')a=await addText();
  if(!a){ta.focus();return}
  const ins='@'+a.nome+' ';
  ta.value=ta.value.slice(0,start)+ins+ta.value.slice(end);
  ta.focus();ta.selectionStart=ta.selectionEnd=start+ins.length;
}
function pickFiles(){
  return new Promise(res=>{const f=$('pgFile');f.value='';f.onchange=()=>res([...f.files]);f.click()});
}

/* ---------------- anexos: nomear ---------------- */
function dialog(html,onOk){
  return new Promise(res=>{
    const d=document.createElement('div');d.className='pg-modal';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');
    d.innerHTML=`<form class="pg-modal-card">${html}<div class="pg-modal-btns"><button type="button" class="pg-btn" data-x>CANCELAR</button><button type="submit" class="pg-btn primary">OK</button></div></form>`;
    document.body.appendChild(d);
    const f=d.querySelector('form'),first=f.querySelector('input,textarea');if(first){first.focus();first.select&&first.select()}
    const close=v=>{d.remove();res(v)};
    d.querySelector('[data-x]').onclick=()=>close(null);
    d.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')close(null)});
    f.onsubmit=e=>{e.preventDefault();const v=onOk(f);if(v!==false)close(v)};
  });
}
function nameField(def,hint){
  return `<label class="pg-lbl">NOME PARA USAR COM @</label><div class="pg-at"><span>@</span><input name="nome" value="${C.esc(def)}" maxlength="24" pattern="[\\p{L}\\p{N}_\\-]+" required></div><div class="pg-hint">${hint||'Sem espaços. Ex.: SlidePr, LetraHino, VideoAbertura'}</div>`;
}
async function addFile(file,dropName){
  const kind=C.kind(file.type,file.name);
  const nome=await dialog(`<h3>${C.icon(kind)} Anexar ${C.esc(C.KIND_LABEL[kind]||'arquivo').toLowerCase()}</h3>
    <div class="pg-file"><b>${C.esc(file.name)}</b><small>${C.size(file.size)}</small></div>${nameField(uniqueName(dropName||file.name))}`,
    f=>uniqueName(f.nome.value));
  if(!nome)return null;
  const id=C.uid(8);
  let texto;if(kind==='texto'&&file.size<200000){try{texto=await file.text()}catch(e){}}
  try{await fput(sess.slug+':'+id,file)}catch(e){toast('Não deu para guardar o arquivo: '+e.message);return null}
  const a={id,nome,kind,mime:file.type,size:file.size,arquivo:file.name,texto};
  P.anexos[id]=a;save();renderLib();toast('@'+nome+' anexado');
  return a;
}
async function addLink(){
  const r=await dialog(`<h3>${C.icon('canva')} Link do Canva</h3><label class="pg-lbl">LINK</label><input name="url" placeholder="https://www.canva.com/design/…" required>${nameField('Slide')}`,
    f=>({url:f.url.value.trim(),nome:uniqueName(f.nome.value)}));
  if(!r||!r.url)return null;
  const url=/^https?:\/\//i.test(r.url)?r.url:'https://'+r.url;
  const a={id:C.uid(8),nome:r.nome,kind:C.kind('','',url),url};
  P.anexos[a.id]=a;save();renderLib();return a;
}
async function addText(){
  const r=await dialog(`<h3>${C.icon('texto')} Texto</h3><label class="pg-lbl">TEXTO (aparece grande no palco)</label><textarea name="t" rows="6" required></textarea>${nameField('Texto')}`,
    f=>({t:f.t.value,nome:uniqueName(f.nome.value)}));
  if(!r||!r.t.trim())return null;
  const a={id:C.uid(8),nome:r.nome,kind:'texto',texto:r.t,size:r.t.length};
  P.anexos[a.id]=a;save();renderLib();return a;
}
async function preview(a){
  let body='';
  try{
    if(a.kind==='imagem')body=`<img class="pg-prev" src="${await urlOf(a)}" alt="">`;
    else if(a.kind==='video')body=`<video class="pg-prev" src="${await urlOf(a)}" controls></video>`;
    else if(a.kind==='musica')body=`<audio src="${await urlOf(a)}" controls style="width:100%"></audio>`;
    else if(a.kind==='texto')body=`<div class="pg-prev-t">${C.esc(a.texto||'').replace(/\n/g,'<br>')}</div>`;
    else if(a.url)body=`<div class="pg-prev-t"><a href="${C.esc(a.url)}" target="_blank" rel="noopener">${C.esc(a.url)}</a></div>`;
  }catch(e){body=`<div class="pg-hint">${C.esc(e.message)}</div>`}
  const r=await dialog(`<h3>${C.icon(a.kind)} @${C.esc(a.nome)} <small>${C.esc(C.KIND_LABEL[a.kind]||'')} ${C.size(a.size)}</small></h3>${body}
    ${nameField(a.nome,'Renomear: as menções nos itens são atualizadas.')}
    <div class="pg-prev-acts"><button type="button" class="pg-btn sm primary" data-use>▶ USAR AGORA</button><button type="button" class="pg-btn sm danger" data-rm>REMOVER</button></div>`,
    f=>({nome:f.nome.value}));
  if(r&&r.nome&&C.cleanName(r.nome)!==a.nome)rename(a,r.nome);
}
function rename(a,n){
  const old=a.nome;a.nome='';const nn=uniqueName(n);a.nome=nn;
  const re=new RegExp('@'+old.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}\\p{N}_-])','giu');
  P.items.forEach(it=>{it.texto=String(it.texto||'').replace(re,'@'+nn)});
  save();render();toast('@'+old+' → @'+nn);
}
async function removeAnexo(a){
  delete P.anexos[a.id];try{await fdel(sess.slug+':'+a.id)}catch(e){}
  if(urlCache[a.id]){URL.revokeObjectURL(urlCache[a.id]);delete urlCache[a.id]}
  save();render();toast('@'+a.nome+' removido');
}

/* ---------------- arrastar e soltar ---------------- */
let dragDepth=0;
function wireDrop(){
  const host=$('panel-prog'),ov=$('pgDrop');
  const hasFiles=e=>[...(e.dataTransfer&&e.dataTransfer.types||[])].some(t=>t==='Files'||t==='text/uri-list');
  host.addEventListener('dragenter',e=>{if(!hasFiles(e))return;e.preventDefault();dragDepth++;ov.classList.add('on')});
  host.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;ov.classList.remove('on')}});
  host.addEventListener('dragover',e=>{if(!hasFiles(e))return;e.preventDefault();
    const it=document.elementsFromPoint(e.clientX,e.clientY).map(x=>x.closest&&x.closest('.pg-item')).find(Boolean);
    document.querySelectorAll('.pg-item.drop-on').forEach(x=>x!==it&&x.classList.remove('drop-on'));
    if(it)it.classList.add('drop-on');
    $('pgDropT').textContent=it?'no item "'+(P.items.find(i=>i.id===it.dataset.id)||{}).titulo+'"':'à biblioteca de anexos';
  });
  host.addEventListener('drop',async e=>{
    if(!hasFiles(e))return;e.preventDefault();dragDepth=0;ov.classList.remove('on');
    const itEl=document.elementsFromPoint(e.clientX,e.clientY).map(x=>x.closest&&x.closest('.pg-item')).find(Boolean);
    document.querySelectorAll('.pg-item.drop-on').forEach(x=>x.classList.remove('drop-on'));
    const ta=e.target.closest&&e.target.closest('textarea');
    const files=[...e.dataTransfer.files];
    const added=[];
    if(files.length){for(const f of files){const a=await addFile(f);if(a)added.push(a)}}
    else{const u=(e.dataTransfer.getData('text/uri-list')||e.dataTransfer.getData('text/plain')||'').split('\n')[0].trim();
      if(u){const n=await dialog(`<h3>${C.icon(C.kind('','',u))} Link</h3><div class="pg-file"><b>${C.esc(u)}</b></div>${nameField(/canva/i.test(u)?'Slide':'Link')}`,f=>uniqueName(f.nome.value));
        if(n){const a={id:C.uid(8),nome:n,kind:C.kind('','',u),url:u};P.anexos[a.id]=a;added.push(a)}}}
    if(!added.length)return;
    const mention=added.map(a=>'@'+a.nome).join(' ');
    if(ta){const p=ta.selectionStart||ta.value.length;ta.value=ta.value.slice(0,p)+(p&&!/\s$/.test(ta.value.slice(0,p))?' ':'')+mention+' '+ta.value.slice(p);return}
    if(itEl){const it=P.items.find(i=>i.id===itEl.dataset.id);if(it){it.texto=(it.texto?it.texto.replace(/\s*$/,' '):'')+mention;P.exemplo=false}}
    save();render();
  });
}

/* ---------------- publicação (MQTT) ---------------- */
function pubPayload(){
  const an={};
  Object.values(P.anexos).forEach(a=>{an[a.id]={id:a.id,nome:a.nome,kind:a.kind,size:a.size||0,url:a.url||undefined,texto:a.kind==='texto'&&(a.texto||'').length<20000?a.texto:undefined}});
  return {v:1,igreja:sess.nome,titulo:P.titulo,data:P.data,items:P.items.map(i=>({id:i.id,hora:i.hora,dur:i.dur,titulo:i.titulo,texto:i.texto,estado:i.estado})),anexos:an,cfg:{aviso:cfg.aviso,lastDur:cfg.lastDur},at:Date.now()};
}
function ensureClient(){
  if(client||!P.pub)return;
  const topics=[C.topicProg(P.pub.id)];if(P.pub.key)topics.push(C.topicComments(P.pub.id,P.pub.key));
  client=C.connect(topics,(t,o,ret)=>{
    if(P.pub&&P.pub.key&&t===C.topicComments(P.pub.id,P.pub.key)){
      const before=new Set(comments.list.map(c=>c.id));
      const merged=C.mergeComments(comments,o);
      const novo=merged.list.filter(c=>!before.has(c.id));
      comments=merged;renderComments();
      if(!ret&&novo.length)toast('Novo comentário de '+(novo[novo.length-1].autor||'alguém'));
    }
  },st=>{if(st==='ready')publishNow();renderPub()});
}
function schedulePublish(){if(!P||!P.pub)return;clearTimeout(pubTimer);pubTimer=setTimeout(publishNow,600)}
function publishNow(){
  if(!P.pub||!client||client.state!=='ready')return;
  client.publish(C.topicProg(P.pub.id),JSON.stringify(pubPayload()),true);
}
function siteUrl(edit){
  const base=location.href.replace(/[#?].*$/,'').replace(/[^/]*$/,'');
  return base+'programacao.html#'+P.pub.id+(edit&&P.pub.key?'.'+P.pub.key:'');
}
function publicar(edit){
  if(!P.pub)P.pub={id:C.uid(10)};
  if(edit&&!P.pub.key)P.pub.key=C.uid(8);
  save();ensureClient();
  if(client&&edit&&client.state==='ready'){/* reassinar com comentários */client.ws&&client.ws.close();client=null;ensureClient()}
  publishNow();renderPub();
  return siteUrl(edit);
}
function despublicar(){
  if(client&&P.pub){client.publish(C.topicProg(P.pub.id),'',true);if(P.pub.key)client.publish(C.topicComments(P.pub.id,P.pub.key),'',true)}
  setTimeout(()=>{try{client&&client.ws&&client.ws.close()}catch(e){}client=null},400);
  P.pub=null;comments={v:1,list:[],del:[]};save();render();toast('Site despublicado');
}
function renderPub(){
  const box=$('pgPubBox');if(!box)return;
  if(!P.pub){box.hidden=true;$('pgCmtBox').hidden=true;return}
  box.hidden=false;
  const on=client&&client.state==='ready';
  $('pgPubInfo').innerHTML=`<div class="pg-pub-st"><i class="${on?'on':''}"></i>${on?'ao vivo — mudanças aparecem na hora':'conectando…'}</div>
    <div class="pg-pub-l"><small>SITE</small><input readonly value="${C.esc(siteUrl(false))}"><button type="button" class="pg-mini" data-copy="${C.esc(siteUrl(false))}" aria-label="Copiar link do site">⧉</button></div>
    ${P.pub.key?`<div class="pg-pub-l"><small>EDITÁVEL</small><input readonly value="${C.esc(siteUrl(true))}"><button type="button" class="pg-mini" data-copy="${C.esc(siteUrl(true))}" aria-label="Copiar link editável">⧉</button></div>`:''}
    <div class="pg-pub-acts"><button type="button" class="pg-btn sm" id="pgDl">BAIXAR .HTML</button><button type="button" class="pg-btn sm danger" id="pgUnpub">DESPUBLICAR</button></div>`;
  $('pgCmtBox').hidden=!P.pub.key;
  $('pgDl').onclick=baixarSite;$('pgUnpub').onclick=despublicar;
}
function renderComments(){
  const box=$('pgCmts');if(!box)return;
  $('pgCmtN').textContent=comments.list.length;
  const bn=byName(),items={};P.items.forEach(i=>items[i.id]=i);
  box.innerHTML=comments.list.length?comments.list.slice().reverse().map(c=>{
    const fbn=Object.assign({},bn);(c.files||[]).forEach(f=>{fbn[String(f.nome).toLowerCase()]={id:'c:'+c.id+':'+f.nome,nome:f.nome,kind:f.kind}});
    return `<div class="pg-cmt"><div class="pg-cmt-h"><b>${C.esc(c.autor||'Anônimo')}</b><small>${C.ago(c.at)}${c.item&&items[c.item]?' · '+C.esc(items[c.item].titulo):''}</small>
      <button type="button" class="pg-mini" data-cdel="${c.id}" aria-label="Apagar comentário">×</button></div>
      <div class="pg-cmt-t">${C.renderText(c.texto,fbn)}</div>
      ${(c.files||[]).map(f=>`<button type="button" class="pg-save" data-csave="${c.id}" data-f="${C.esc(f.nome)}">${C.icon(f.kind)} salvar @${C.esc(f.nome)} nos anexos</button>`).join('')}</div>`}).join(''):'<div class="pg-empty">Ninguém comentou ainda.</div>';
}
async function baixarSite(){
  try{
    const r=await fetch('programacao.html');let h=await r.text();
    const core=await (await fetch('prog/core.js')).text(),cc=await (await fetch('prog/core-comments.js')).text();
    const data=pubPayload();
    h=h.replace('<script src="prog/core.js"></script>','<script>'+core+'<\/script>').replace('<script src="prog/core-comments.js"></script>','<script>'+cc+'<\/script>')
       .replace('<script src="prog/mqtt.js"></script>','').replace('<!--PF_EMBED-->','<script>window.PF_EMBED='+JSON.stringify(data).replace(/</g,'\\u003c')+'<\/script>');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([h],{type:'text/html'}));a.download=(C.cleanName(P.titulo)||'programacao')+'.html';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  }catch(e){toast('Não deu para gerar o arquivo: '+e.message)}
}

/* ---------------- exportar imagem ---------------- */
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('não carregou '+src));document.head.appendChild(s)})}
async function exportImage(fmt){
  toast('Gerando '+fmt.toUpperCase()+'…');
  try{
    if(!window.htmlToImage)await loadScript('prog/vendor/html-to-image.js');
    if(fmt==='pdf'&&!window.PDFLib)await loadScript('prog/vendor/pdf-lib.min.js');
  }catch(e){toast(e.message);return}
  const st=C.compute(P.items,{aviso:cfg.aviso,lastDur:cfg.lastDur});
  const bn=byName();
  const el=document.createElement('div');el.className='pg-print';
  const dataTxt=P.data?new Date(P.data+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'';
  el.innerHTML=`<div class="pp-h"><small>${C.esc(sess.nome)}</small><h1>${C.esc(P.titulo)}</h1><span>${C.esc(dataTxt)}</span></div>
    ${C.sorted(P.items).map(it=>{const s=st.map[it.id];return `<div class="pp-it st-${s.state}"><div class="pp-t">${C.esc(it.hora||'--:--')}</div><span class="pg-dot st-${s.state}"></span>
      <div class="pp-c"><b>${C.esc(it.titulo)}</b>${it.estado==='ignorado'?' <em>(não acontecerá)</em>':''}${it.texto?`<p>${C.renderText(it.texto,bn).replace(/<svg[\s\S]*?<\/svg>/g,'')}</p>`:''}</div></div>`}).join('')}
    <div class="pp-f">Gerado com O Púlpito · ${new Date().toLocaleString('pt-BR')}</div>`;
  document.body.appendChild(el);
  const name=(C.cleanName(P.titulo)||'programacao');
  const save=(href,fn)=>{const a=document.createElement('a');a.href=href;a.download=fn;document.body.appendChild(a);a.click();a.remove()};
  try{
    const opt={pixelRatio:2,backgroundColor:'#0a0d13',style:{left:'0',top:'0',position:'static'}};
    if(fmt==='jpeg'){
      save(await htmlToImage.toJpeg(el,Object.assign({quality:.92},opt)),name+'.jpg');
    }else{
      const cv=await htmlToImage.toCanvas(el,opt);
      const {PDFDocument,rgb}=PDFLib;const doc=await PDFDocument.create();
      const PW=595.28,PH=841.89,scale=PW/cv.width,sliceH=Math.floor(PH/scale);
      for(let y=0;y<cv.height;y+=sliceH){
        const h=Math.min(sliceH,cv.height-y);
        const c2=document.createElement('canvas');c2.width=cv.width;c2.height=h;c2.getContext('2d').drawImage(cv,0,y,cv.width,h,0,0,cv.width,h);
        const jpg=await doc.embedJpg(await (await fetch(c2.toDataURL('image/jpeg',.92))).arrayBuffer());
        const page=doc.addPage([PW,PH]);
        page.drawRectangle({x:0,y:0,width:PW,height:PH,color:rgb(10/255,13/255,19/255)});
        page.drawImage(jpg,{x:0,y:PH-h*scale,width:PW,height:h*scale});
      }
      doc.setTitle(P.titulo||'Programação');doc.setAuthor(sess.nome);
      const bytes=await doc.save();
      const u=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));save(u,name+'.pdf');setTimeout(()=>URL.revokeObjectURL(u),5000);
    }
    toast('Pronto: '+fmt.toUpperCase());
  }catch(e){toast('Falhou: '+(e&&e.message||e))}
  finally{el.remove()}
}

/* ---------------- configurações ---------------- */
function openConfig(){
  const d=document.createElement('div');d.className='pg-modal';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-label','Configurações');
  d.innerHTML=`<div class="pg-modal-card wide">
    <h3>Configurações</h3>
    <div class="cf-sec"><h4>PROGRAMAÇÃO</h4>
      <label class="cf-row"><span>Quando um item entrar <b>no ar</b><small>o que o palco faz com o slide, imagem, vídeo, texto ou música anexados</small></span>
        <select id="cfAcao"><option value="nada">Não fazer nada</option><option value="perguntar">Mostrar aviso com botão "usar"</option><option value="auto">Usar automaticamente</option></select></label>
      <label class="cf-row"><span>Bolinha laranja (<b>prestes a acontecer</b>)<small>quantos minutos antes</small></span><input type="number" id="cfAviso" min="1" max="60"></label>
      <label class="cf-row"><span>Duração do último item<small>quando ele não tiver duração própria (min)</small></span><input type="number" id="cfLast" min="5" max="600"></label>
      <label class="cf-row"><span>Rolar sozinho até o item no ar</span><input type="checkbox" id="cfRolar"></label>
      <label class="cf-row"><span>Abaixar a música do Fundo ao tocar música anexada</span><input type="checkbox" id="cfDuck"></label>
    </div>
    <div class="cf-sec"><h4>DADOS</h4>
      <div class="cf-row"><span>Backup da programação<small>sem os arquivos (eles ficam neste computador)</small></span>
        <span class="cf-btns"><button type="button" class="pg-btn sm" id="cfExp">BAIXAR</button><button type="button" class="pg-btn sm" id="cfImp">RESTAURAR</button></span></div>
      <div class="cf-row"><span>Nova programação<small>apaga os itens atuais (mantém os anexos)</small></span><button type="button" class="pg-btn sm danger" id="cfNew">NOVA</button></div>
    </div>
    <div class="cf-sec"><h4>CONTA</h4>
      <div class="cf-row"><span>Igreja<small>login simulado neste navegador (desenvolvimento)</small></span><b>${C.esc(sess.nome)}</b></div>
      <div class="cf-row"><span></span><button type="button" class="pg-btn sm danger" id="cfOut">SAIR</button></div>
    </div>
    <div class="pg-modal-btns"><button type="button" class="pg-btn primary" data-x>FECHAR</button></div>
    <input type="file" id="cfFile" accept="application/json" hidden></div>`;
  document.body.appendChild(d);
  const q=id=>d.querySelector('#'+id);
  q('cfAcao').value=cfg.acao;q('cfAviso').value=cfg.aviso;q('cfLast').value=cfg.lastDur;q('cfRolar').checked=cfg.rolar;q('cfDuck').checked=cfg.duck;
  const upd=()=>{cfg.acao=q('cfAcao').value;cfg.aviso=Math.max(1,+q('cfAviso').value||5);cfg.lastDur=Math.max(5,+q('cfLast').value||30);cfg.rolar=q('cfRolar').checked;cfg.duck=q('cfDuck').checked;saveCfg();tick();schedulePublish()};
  d.querySelectorAll('select,input').forEach(x=>x.addEventListener('change',upd));
  const close=()=>{d.remove();$('tsConfig')&&$('tsConfig').focus()};
  d.querySelector('[data-x]').onclick=close;d.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')close()});
  d.addEventListener('click',e=>{if(e.target===d)close()});
  q('cfOut').onclick=()=>PFAuth.sair();
  q('cfNew').onclick=()=>{if(!confirmar(q('cfNew')))return;P.items=[];P.exemplo=false;save();render();close();addItem()};
  q('cfExp').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({programacao:P,config:cfg},null,2)],{type:'application/json'}));a.download='programacao-backup.json';a.click()};
  q('cfImp').onclick=()=>q('cfFile').click();
  q('cfFile').onchange=async()=>{try{const o=JSON.parse(await q('cfFile').files[0].text());if(!o.programacao||!Array.isArray(o.programacao.items))throw new Error('arquivo inválido');
    const keepPub=P.pub;P=o.programacao;P.pub=keepPub;P.anexos=Object.assign({},P.anexos||{});if(o.config)cfg=Object.assign({},DEF_CFG,o.config);saveCfg();save();render();toast('Programação restaurada');close()}catch(e){toast('Não deu: '+e.message)}};
  q('cfAcao').focus();
}
/* confirmação em 2 cliques (sem diálogo do navegador) */
function confirmar(btn){
  if(btn.dataset.sure)return true;
  const t=btn.textContent;btn.dataset.sure='1';btn.textContent='CLIQUE DE NOVO';
  setTimeout(()=>{btn.textContent=t;delete btn.dataset.sure},2500);return false;
}

/* ---------------- eventos ---------------- */
function wire(){
  $('pgTitle').addEventListener('input',e=>{P.titulo=e.target.value;P.exemplo=false;save()});
  $('pgDate').addEventListener('change',e=>{P.data=e.target.value;save()});
  $('pgAdd').onclick=addItem;
  $('pgNew').onclick=()=>{P.items=[];P.exemplo=false;save();render();addItem()};
  $('pgAttach').onclick=async()=>{for(const f of await pickFiles())await addFile(f)};
  $('pgAddLink').onclick=addLink;$('pgAddText').onclick=addText;
  $('pgPlStop').onclick=stopAudio;
  $('pgAudio').addEventListener('ended',()=>{if(pgDucked&&typeof window.setDuck==='function')window.setDuck(false);pgDucked=false});
  const eb=$('pgExportBtn'),em=$('pgExportMenu');
  eb.onclick=e=>{e.stopPropagation();em.hidden=!em.hidden;eb.setAttribute('aria-expanded',String(!em.hidden))};
  document.addEventListener('click',e=>{if(!em.hidden&&!e.target.closest('.pg-menu-wrap')){em.hidden=true;eb.setAttribute('aria-expanded','false')}});
  em.addEventListener('click',async e=>{
    const b=e.target.closest('[data-x]');if(!b)return;em.hidden=true;
    const x=b.dataset.x;
    if(x==='pdf'||x==='jpeg')return exportImage(x);
    const url=publicar(x==='edit');
    try{await navigator.clipboard.writeText(url);toast('Link copiado: '+(x==='edit'?'site editável':'site'))}catch(_){toast('Link pronto na lateral')}
  });
  const wrap=$('pgWrap');
  wrap.addEventListener('click',e=>{
    const chip=e.target.closest('.pf-chip[data-anexo]');if(chip){e.stopPropagation();const a=P.anexos[chip.dataset.anexo];if(a)preview(a).then(()=>{});return}
    const u=e.target.closest('[data-use]');if(u){use(P.anexos[u.dataset.use]);return}
    const cp=e.target.closest('[data-copy]');if(cp){navigator.clipboard.writeText(cp.dataset.copy).then(()=>toast('Link copiado'),()=>{});return}
    const cd=e.target.closest('[data-cdel]');if(cd){if(!confirmar(cd))return;comments=C.mergeComments(comments,{list:[],del:[cd.dataset.cdel]});comments.list=comments.list.filter(c=>c.id!==cd.dataset.cdel);
      if(client)client.publish(C.topicComments(P.pub.id,P.pub.key),JSON.stringify(comments),true);renderComments();return}
    const cs=e.target.closest('[data-csave]');if(cs){const c=comments.list.find(x=>x.id===cs.dataset.csave),f=c&&(c.files||[]).find(x=>x.nome===cs.dataset.f);
      if(f){const b=C.dataToBlob(f.data);addFile(new File([b],f.arquivo||f.nome,{type:b.type}),f.nome)}return}
    const item=e.target.closest('.pg-item');
    const act=e.target.closest('[data-act]');
    if(item&&act){
      const it=P.items.find(i=>i.id===item.dataset.id);if(!it)return;
      if(act.dataset.act==='ign'){if(item.classList.contains('editing'))commitEdit(item);it.estado=it.estado==='ignorado'?'auto':'ignorado';save();render();return}
      if(act.dataset.act==='del'){if(!confirmar(act))return;P.items=P.items.filter(i=>i!==it);editing=null;save();render();return}
      if(act.dataset.act==='edit'){if(editing)finishEdit();editing=it.id;render();return}
    }
    if(item&&!item.classList.contains('editing')&&!e.target.closest('button,a')){if(editing)finishEdit();editing=item.dataset.id;render()}
  });
  // abrir o anexo de dentro de um chip ainda dentro do modal de preview
  document.addEventListener('click',e=>{
    const m=e.target.closest('.pg-modal');if(!m)return;
    const ch=m.querySelector('h3');if(!ch)return;
    if(e.target.closest('[data-use]')||e.target.closest('[data-rm]')){
      const nm=(ch.textContent.match(/@([\p{L}\p{N}_-]+)/u)||[])[1];const a=nm&&byName()[nm.toLowerCase()];
      if(!a)return;
      if(e.target.closest('[data-use]')){m.remove();use(a)}
      else if(confirmar(e.target.closest('[data-rm]'))){m.remove();removeAnexo(a)}
    }
  });
  wrap.addEventListener('submit',e=>{if(e.target.closest('.pg-edit')){e.preventDefault();finishEdit()}});
  wrap.addEventListener('input',e=>{if(e.target.matches('.pg-edit textarea'))acCheck(e.target)});
  wrap.addEventListener('keydown',e=>{
    const ta=e.target.matches&&e.target.matches('.pg-edit textarea')?e.target:null;
    if(ta&&ac.ta===ta&&!$('pgAc').hidden){
      if(e.key==='ArrowDown'){e.preventDefault();ac.sel=(ac.sel+1)%ac.opts.length;drawAc();return}
      if(e.key==='ArrowUp'){e.preventDefault();ac.sel=(ac.sel-1+ac.opts.length)%ac.opts.length;drawAc();return}
      if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();acPick(ac.sel);return}
      if(e.key==='Escape'){e.preventDefault();hideAc();return}
    }
    if(e.target.closest&&e.target.closest('.pg-edit')){
      e.stopPropagation(); // não deixa as teclas do palco (espaço = fala, setas = slides) agirem enquanto digita
      if(e.key==='Escape'){e.preventDefault();finishEdit()}
      if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();finishEdit()}
      return;
    }
    if(e.key==='Enter'&&e.target.classList&&e.target.classList.contains('pg-item')){editing=e.target.dataset.id;render()}
  });
  $('pgAc').addEventListener('mousedown',e=>{const o=e.target.closest('[data-i]');if(o){e.preventDefault();acPick(+o.dataset.i)}});
  wrap.addEventListener('focusout',e=>{if(e.target.matches&&e.target.matches('.pg-edit textarea'))setTimeout(()=>{if(document.activeElement!==ac.ta)hideAc()},150)});
  ['pgTitle','pgDate'].forEach(id=>$(id).addEventListener('keydown',e=>e.stopPropagation()));
  wireDrop();
}

/* ---------------- início ---------------- */
async function init(s){
  sess=s;load();mount();render();
  if(P.pub)ensureClient();
  setInterval(()=>tick(),10000);
  // o relógio da aba e os estados também mudam quando a aba é aberta
  new MutationObserver(()=>{if(document.body.classList.contains('tab-prog'))tick(true)}).observe(document.body,{attributes:true,attributeFilter:['class']});
  const cb=$('tsConfig');if(cb)cb.onclick=openConfig;
  const ch=$('tsChurch');if(ch){ch.textContent=s.nome;ch.onclick=openConfig}
}
window.PFProg={init,closeMedia,mediaOn:()=>document.body.classList.contains('pf-media-on'),use,openConfig,_state:()=>({P,cfg,comments})};
if(window.PFAuth)PFAuth.ready.then(s=>{if(s&&document.getElementById('panel-prog'))init(s)});
})();
