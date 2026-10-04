/* PREACH FLOW · comentários do "site editável" (MQTT, mensagem retida = lista completa) */
(function(){
'use strict';
const C=window.PFCore;
const LIMIT_FILE=300*1024, LIMIT_TOTAL=750*1024;
C.LIMIT_FILE=LIMIT_FILE;C.LIMIT_TOTAL=LIMIT_TOTAL;
/* une duas listas (sem perder comentário de ninguém); "del" guarda os apagados */
C.mergeComments=(a,b)=>{
  a=a||{list:[],del:[]};b=b||{list:[],del:[]};
  const del=new Set([...(a.del||[]),...(b.del||[])]);
  const m=new Map();
  [...(a.list||[]),...(b.list||[])].forEach(c=>{if(c&&c.id&&!del.has(c.id))m.set(c.id,c)});
  return {v:1,list:[...m.values()].sort((x,y)=>x.at-y.at),del:[...del].slice(-500)};
};
C.commentsSize=o=>new Blob([JSON.stringify(o)]).size;
C.topicProg=id=>'pfp/'+id+'/prog';
C.topicComments=(id,key)=>'pfp/'+id+'/'+key+'/c';
C.fileToData=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});
C.dataToBlob=d=>{const [h,b]=d.split(',');const mime=(h.match(/data:([^;]+)/)||[])[1]||'application/octet-stream';const bin=atob(b);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type:mime})};
C.ago=t=>{const s=(Date.now()-t)/1000;if(s<60)return 'agora';if(s<3600)return Math.floor(s/60)+' min';if(s<86400)return Math.floor(s/3600)+' h';return new Date(t).toLocaleDateString('pt-BR')};
/* conexão simples publicar/assinar */
C.connect=(topics,onMsg,onState)=>{
  if(!window.PFMqtt)return null;
  const cl=new PFMqtt();
  cl.start({topics,onState:onState||(()=>{}),onMessage:(t,txt,ret)=>{let o=null;try{o=txt?JSON.parse(txt):null}catch(e){return}onMsg(t,o,ret)}});
  return cl;
};
})();
