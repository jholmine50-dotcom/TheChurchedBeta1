/* O Púlpito · login da igreja (SIMULADO — fase de desenvolvimento)
 *
 * O "banco de dados" é simulado no navegador (localStorage 'pf.db').
 * A senha NUNCA é guardada crua. Ela passa por DUAS codificações de mão única:
 *   1) PBKDF2-SHA256 com sal aleatório de 16 bytes e 210.000 iterações
 *   2) SHA-256( resultado1 || sal )
 * Só o resultado 2 (+ o sal e o número de iterações) vai para o banco.
 * Não existe caminho de volta (hash -> senha). No login, a senha digitada passa
 * pelas mesmas duas codificações e o resultado é comparado com o do banco.
 * Quando houver servidor de verdade, essa mesma rotina roda no servidor.
 */
(function(){
'use strict';
const DB_KEY='pf.db', SESS_KEY='pf.sess', ITER=210000;
const enc=new TextEncoder();
const b64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const slugOf=n=>String(n||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

function dbRead(){try{return JSON.parse(localStorage.getItem(DB_KEY))||{igrejas:{}}}catch(e){return {igrejas:{}}}}
function dbWrite(db){localStorage.setItem(DB_KEY,JSON.stringify(db))}

async function hash2(senha,salt,iter){
  if(!(window.crypto&&crypto.subtle))throw new Error('Este navegador não tem criptografia segura (abra pelo site https).');
  const key=await crypto.subtle.importKey('raw',enc.encode(senha),'PBKDF2',false,['deriveBits']);
  const h1=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:iter},key,256); // 1ª codificação
  const both=new Uint8Array(h1.byteLength+salt.length);both.set(new Uint8Array(h1),0);both.set(salt,h1.byteLength);
  return new Uint8Array(await crypto.subtle.digest('SHA-256',both));                                     // 2ª codificação
}
function sameBytes(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0}

async function criar(nome,senha){
  nome=String(nome||'').trim();
  const slug=slugOf(nome);
  if(slug.length<2)throw new Error('Digite o nome da igreja.');
  if(String(senha||'').length<6)throw new Error('A senha precisa ter pelo menos 6 caracteres.');
  const db=dbRead();
  if(db.igrejas[slug])throw new Error('Já existe uma igreja com esse nome. Use "Entrar".');
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const h=await hash2(senha,salt,ITER);
  db.igrejas[slug]={nome,salt:b64(salt),hash:b64(h),iter:ITER,algo:'pbkdf2-sha256+sha256',criada:new Date().toISOString()};
  dbWrite(db);
  return {slug,nome};
}
let falhas=0,bloqueadoAte=0;
async function entrar(nome,senha){
  if(Date.now()<bloqueadoAte)throw new Error('Muitas tentativas. Espere '+Math.ceil((bloqueadoAte-Date.now())/1000)+'s.');
  const slug=slugOf(nome);
  const reg=dbRead().igrejas[slug];
  // mesmo custo de tempo exista ou não a igreja (não revela quais nomes existem)
  const salt=reg?unb64(reg.salt):crypto.getRandomValues(new Uint8Array(16));
  const h=await hash2(String(senha||''),salt,reg?reg.iter:ITER);
  if(!reg||!sameBytes(h,unb64(reg.hash))){
    falhas++;if(falhas>=5){bloqueadoAte=Date.now()+30000;falhas=0}
    throw new Error('Nome da igreja ou senha incorretos.');
  }
  falhas=0;
  return {slug,nome:reg.nome};
}
function salvarSessao(s,lembrar){
  const v=JSON.stringify({slug:s.slug,nome:s.nome,ate:Date.now()+(lembrar?30:1)*864e5});
  try{(lembrar?localStorage:sessionStorage).setItem(SESS_KEY,v)}catch(e){}
}
function sessao(){
  for(const st of [sessionStorage,localStorage]){
    try{const s=JSON.parse(st.getItem(SESS_KEY));if(s&&s.slug&&s.ate>Date.now()&&dbRead().igrejas[s.slug])return s}catch(e){}
  }
  return null;
}
function sair(){try{localStorage.removeItem(SESS_KEY);sessionStorage.removeItem(SESS_KEY)}catch(e){}location.reload()}

/* ---------- tela ---------- */
const CSS=`
#pfAuth{position:fixed;inset:0;z-index:900;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(4,6,9,.55);
  -webkit-backdrop-filter:blur(18px) saturate(140%);backdrop-filter:blur(18px) saturate(140%);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#eef4f8}
#pfAuth .au-card{position:relative;width:100%;max-width:420px;border-radius:28px;padding:28px 24px 22px;border:1px solid rgba(255,255,255,.16);
  background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.04)),rgba(14,18,26,.55);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 30px 80px rgba(0,0,0,.55)}
#pfAuth .au-mark{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;font-weight:900;color:#05200f;background:linear-gradient(135deg,#86efac,#22c55e);box-shadow:0 8px 24px rgba(74,222,128,.35)}
#pfAuth h1{font-size:22px;margin:14px 0 4px}
#pfAuth p.au-sub{margin:0 0 18px;color:#9aa6b4;font-size:13.5px;line-height:1.5}
#pfAuth .au-seg{display:flex;gap:4px;padding:4px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);margin-bottom:16px}
#pfAuth .au-seg button{flex:1;height:38px;border:0;border-radius:999px;background:transparent;color:#9aa6b4;font:800 12px/1 inherit;letter-spacing:1.2px;cursor:pointer}
#pfAuth .au-seg button.on{background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,.08));color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
#pfAuth label{display:block;font-size:11px;letter-spacing:1.4px;font-weight:800;color:#9aa6b4;margin:12px 0 7px}
#pfAuth input[type=text],#pfAuth input[type=password]{width:100%;height:48px;padding:0 14px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.3);color:#fff;font-size:16px;outline:none;box-sizing:border-box}
#pfAuth input:focus{border-color:rgba(170,255,215,.75)}
#pfAuth .au-row{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;color:#b9c4d0}
#pfAuth .au-row input{width:18px;height:18px;accent-color:#4ade80}
#pfAuth .au-go{width:100%;height:52px;margin-top:16px;border-radius:16px;border:1px solid rgba(255,255,255,.55);cursor:pointer;font:900 14px/1 inherit;letter-spacing:2px;color:#05140c;
  background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0) 60%),rgba(170,255,210,.92)}
#pfAuth .au-go[disabled]{opacity:.6;cursor:wait}
#pfAuth .au-err{min-height:20px;margin-top:10px;color:#ff9aa6;font-size:13px}
#pfAuth .au-note{margin-top:8px;font-size:11.5px;line-height:1.5;color:#738091;border-top:1px solid rgba(255,255,255,.08);padding-top:12px}
#pfAuth .au-conf{display:none}#pfAuth.criar .au-conf{display:block}
`;
function tela(){
  return new Promise(resolve=>{
    const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
    const w=document.createElement('div');w.id='pfAuth';w.setAttribute('role','dialog');w.setAttribute('aria-modal','true');w.setAttribute('aria-labelledby','auT');
    const temIgreja=Object.keys(dbRead().igrejas).length>0;
    w.innerHTML=`<form class="au-card" autocomplete="on" novalidate>
      <div class="au-mark" style="overflow:hidden;background:none"><img src="icon/pulpito-192.png" alt="" style="width:100%;height:100%;display:block"></div>
      <h1 id="auT">O Púlpito</h1>
      <p class="au-sub">Entre com a sua igreja para abrir o palco.</p>
      <div class="au-seg" role="tablist"><button type="button" data-m="entrar" role="tab">ENTRAR</button><button type="button" data-m="criar" role="tab">CRIAR IGREJA</button></div>
      <label for="auNome">NOME DA IGREJA</label><input type="text" id="auNome" autocomplete="username" placeholder="ex.: Igreja Batista Central" required>
      <label for="auSenha">SENHA</label><input type="password" id="auSenha" autocomplete="current-password" required>
      <div class="au-conf"><label for="auSenha2">CONFIRMAR SENHA</label><input type="password" id="auSenha2" autocomplete="new-password"></div>
      <div class="au-row"><input type="checkbox" id="auLembrar" checked><label for="auLembrar" style="margin:0;font-size:13px;letter-spacing:0;font-weight:500;color:#b9c4d0">Manter conectado neste computador (30 dias)</label></div>
      <button class="au-go" type="submit">ENTRAR</button>
      <div class="au-err" role="alert" aria-live="assertive"></div>
      <div class="au-note">Modo desenvolvimento: o login é simulado e fica salvo só neste navegador. A senha é guardada codificada duas vezes (PBKDF2 + SHA-256, com sal) — nunca a senha em si.</div>
    </form>`;
    document.body.appendChild(w);
    const f=w.querySelector('form'),err=w.querySelector('.au-err'),go=w.querySelector('.au-go');
    let modo='entrar';
    function setModo(m){modo=m;w.classList.toggle('criar',m==='criar');
      w.querySelectorAll('.au-seg button').forEach(b=>{b.classList.toggle('on',b.dataset.m===m);b.setAttribute('aria-selected',b.dataset.m===m)});
      go.textContent=m==='criar'?'CRIAR E ENTRAR':'ENTRAR';
      w.querySelector('#auSenha').autocomplete=m==='criar'?'new-password':'current-password';err.textContent=''}
    w.querySelectorAll('.au-seg button').forEach(b=>b.onclick=()=>setModo(b.dataset.m));
    setModo(temIgreja?'entrar':'criar');
    setTimeout(()=>w.querySelector('#auNome').focus(),60);
    f.onsubmit=async e=>{
      e.preventDefault();err.textContent='';
      const nome=w.querySelector('#auNome').value,s1=w.querySelector('#auSenha').value,s2=w.querySelector('#auSenha2').value;
      if(modo==='criar'&&s1!==s2){err.textContent='As senhas não conferem.';return}
      go.disabled=true;const t=go.textContent;go.textContent='VERIFICANDO…';
      try{
        const s=modo==='criar'?await criar(nome,s1):await entrar(nome,s1);
        salvarSessao(s,w.querySelector('#auLembrar').checked);
        w.remove();resolve(sessao()||s);
      }catch(ex){err.textContent=ex.message||String(ex)}
      finally{go.disabled=false;go.textContent=t}
    };
  });
}

/* Só o PALCO pede login. O celular (link com #CÓDIGO) entra direto. */
const isPalco=!(location.hash||'').replace('#','').trim();
let readyResolve;const ready=new Promise(r=>readyResolve=r);
function start(){
  if(!isPalco){readyResolve(null);return}
  const s=sessao();
  if(s){readyResolve(s);return}
  tela().then(readyResolve);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();

window.PFAuth={ready,sessao,sair,slugOf,_criar:criar,_entrar:entrar,_db:dbRead};
})();
