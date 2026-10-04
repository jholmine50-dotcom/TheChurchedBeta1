/* O Púlpito · Programação — regras compartilhadas (palco e página pública) */
(function(){
'use strict';
const C={};
C.pad=n=>String(n).padStart(2,'0');
C.toMin=h=>{const m=/^(\d{1,2}):(\d{2})/.exec(h||'');return m?(+m[1])*60+(+m[2]):null};
C.fmt=min=>C.pad(Math.floor(min/60)%24)+':'+C.pad(Math.floor(min)%60);
C.nowMin=()=>{const d=new Date();return d.getHours()*60+d.getMinutes()+d.getSeconds()/60};
C.uid=(n=10)=>{const A='23456789abcdefghjkmnpqrstuvwxyz';const b=crypto.getRandomValues(new Uint8Array(n));let s='';for(const x of b)s+=A[x%A.length];return s};
C.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
C.sorted=items=>items.slice().sort((a,b)=>{const x=C.toMin(a.hora),y=C.toMin(b.hora);return (x==null?1e9:x)-(y==null?1e9:y)});

/* estado de cada item pelo relógio */
C.STATES={
  noar:{label:'No ar',color:'#4ade80'},
  prestes:{label:'Prestes a acontecer',color:'#fb923c'},
  ignorado:{label:'Ignorado',color:'#050505'},
  passou:{label:'Já aconteceu',color:'#64748b'},
  agendado:{label:'Agendado',color:'#93c5fd'},
  semhora:{label:'Sem horário',color:'#334155'}
};
C.compute=(items,opt)=>{
  opt=opt||{};
  const aviso=opt.aviso!=null?+opt.aviso:5,lastDur=opt.lastDur!=null?+opt.lastDur:30,now=opt.now!=null?opt.now:C.nowMin();
  const list=C.sorted(items).filter(i=>C.toMin(i.hora)!=null);
  const act=list.filter(i=>i.estado!=='ignorado');
  const res={};let live=null,next=null;
  list.forEach(it=>{
    const start=C.toMin(it.hora);
    let end;
    if(+it.dur>0)end=start+(+it.dur);
    else{const nx=act.find(j=>C.toMin(j.hora)>start);end=nx?C.toMin(nx.hora):start+lastDur}
    let st;
    if(it.estado==='ignorado')st='ignorado';
    else if(now>=start&&now<end)st='noar';
    else if(now<start&&start-now<=aviso)st='prestes';
    else if(now>=end)st='passou';
    else st='agendado';
    res[it.id]={state:st,start,end,progress:st==='noar'?(now-start)/Math.max(1e-6,end-start):st==='passou'?1:0,inMin:start-now};
    if(st==='noar'&&(!live||start>=res[live.id].start))live=it;
    if((st==='prestes'||st==='agendado')&&!next)next=it;
  });
  items.forEach(it=>{if(!res[it.id])res[it.id]={state:'semhora',start:null,end:null,progress:0}});
  return {map:res,live,next,now};
};

/* anexos */
C.MENTION=/@([\p{L}\p{N}_-]+)/gu;
C.cleanName=s=>{
  const n=String(s||'').normalize('NFC').replace(/\.[a-z0-9]{1,5}$/i,'').replace(/[^\p{L}\p{N}_-]+/gu,'').slice(0,24);
  return n||'Anexo';
};
C.kind=(mime,name,url)=>{
  mime=mime||'';name=(name||'').toLowerCase();
  if(url&&/canva\.(com|link)/i.test(url))return 'canva';
  if(url)return 'link';
  if(mime.startsWith('image/'))return 'imagem';
  if(mime.startsWith('video/'))return 'video';
  if(mime.startsWith('audio/'))return 'musica';
  if(mime==='application/pdf'||name.endsWith('.pdf'))return 'pdf';
  if(mime.startsWith('text/')||/\.(txt|md)$/.test(name))return 'texto';
  if(/\.(pptx?|key|odp)$/.test(name))return 'slides';
  return 'arquivo';
};
C.KIND_LABEL={canva:'Slide (Canva)',link:'Link',imagem:'Imagem',video:'Vídeo',musica:'Música',pdf:'PDF',texto:'Texto',slides:'Slides',arquivo:'Arquivo'};
const P={
  canva:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  slides:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  imagem:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  video:'<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m22 8-6 4 6 4V8z"/>',
  musica:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  pdf:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
  texto:'<path d="M4 6h16M4 12h16M4 18h10"/>',
  arquivo:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'
};
C.icon=(k,cls)=>'<svg class="'+(cls||'pf-ic')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(P[k]||P.arquivo)+'</svg>';
C.size=b=>!b?'':b<1024?b+' B':b<1048576?(b/1024).toFixed(0)+' KB':(b/1048576).toFixed(1)+' MB';

/* texto com @menções -> HTML com "chips" */
C.renderText=(text,byName,opt)=>{
  opt=opt||{};
  let out='',last=0;const s=String(text||'');
  s.replace(C.MENTION,(m,name,idx)=>{
    out+=C.esc(s.slice(last,idx));last=idx+m.length;
    const a=byName[name.toLowerCase()];
    if(a)out+='<button type="button" class="pf-chip k-'+a.kind+'" data-anexo="'+C.esc(a.id)+'" title="'+C.esc(C.KIND_LABEL[a.kind]||'Anexo')+'">'+C.icon(a.kind)+'@'+C.esc(a.nome)+'</button>';
    else out+='<span class="pf-chip-miss" title="Anexo não encontrado">@'+C.esc(name)+'</span>';
    return m;
  });
  out+=C.esc(s.slice(last));
  return out.replace(/\n/g,'<br>');
};
C.mentions=text=>{const r=[];String(text||'').replace(C.MENTION,(m,n)=>{r.push(n.toLowerCase());return m});return r};
C.byName=anexos=>{const o={};Object.values(anexos||{}).forEach(a=>{o[String(a.nome).toLowerCase()]=a});return o};

window.PFCore=C;
})();
