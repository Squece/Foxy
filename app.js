// ============================================================
//  CATEA — app.js  (versão corrigida e completa)
//  Firebase Auth + Firestore + Todas as funções de UI
// ============================================================

import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc, setDoc, getDoc, updateDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ════════════════════════════════════════════════════════════
//  CONSTANTES
// ════════════════════════════════════════════════════════════

const MAX_INTERESTS = 3;

const AVATARS = [
  { id:"gato",emoji:"🐱",label:"Gato" },
  { id:"raposa",emoji:"🦊",label:"Raposa" },
  { id:"urso",emoji:"🐻",label:"Urso" },
  { id:"panda",emoji:"🐼",label:"Panda" },
  { id:"coelho",emoji:"🐰",label:"Coelho" },
  { id:"pinguim",emoji:"🐧",label:"Pinguim" },
  { id:"sapo",emoji:"🐸",label:"Sapo" },
  { id:"lobo",emoji:"🐺",label:"Lobo" },
  { id:"hamster",emoji:"🐹",label:"Hamster" },
  { id:"leao",emoji:"🦁",label:"Leão" },
  { id:"elefante",emoji:"🐘",label:"Elefante" },
  { id:"tartaruga",emoji:"🐢",label:"Tartaruga" },
];

const INTERESTS_LIST = [
  { id:"musica",emoji:"🎵",label:"Música" },
  { id:"jogos",emoji:"🎮",label:"Jogos" },
  { id:"animes",emoji:"🎌",label:"Animes" },
  { id:"livros",emoji:"📚",label:"Livros" },
  { id:"arte",emoji:"🎨",label:"Arte" },
  { id:"culinaria",emoji:"🍳",label:"Culinária" },
  { id:"tecnologia",emoji:"💻",label:"Tecnologia" },
  { id:"natureza",emoji:"🌿",label:"Natureza" },
  { id:"filmes",emoji:"🎬",label:"Filmes" },
  { id:"esportes",emoji:"⚽",label:"Esportes" },
  { id:"fotografia",emoji:"📷",label:"Fotografia" },
  { id:"viagens",emoji:"✈️",label:"Viagens" },
];

const PAGE_MAP = {
  landing:"index.html", login:"login.html", register:"register.html",
  dashboard:"dashboard.html", games:"games.html", gameroom:"gameroom.html",
  waiting:"waiting.html", profile:"profile.html", achievements:"achievements.html",
  settings:"settings.html", safety:"safety.html",
};

// ════════════════════════════════════════════════════════════
//  ESTADO LOCAL
// ════════════════════════════════════════════════════════════
let selectedAvatar    = null;
let selectedInterests = [];
let selectedComfort   = "low";
let currentUser       = null;
let currentGame       = null;
const googleProvider  = new GoogleAuthProvider();

// ════════════════════════════════════════════════════════════
//  1. AUTH STATE
// ════════════════════════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  const page  = document.body.dataset.page;
  if (user) {
    if (page === "login" || page === "register") window.location.href = "dashboard.html";
    else await loadUserUI(user);
  } else {
    const publicPages = ["login","register","landing"];
    if (!publicPages.includes(page)) window.location.href = "login.html";
  }
});

// ════════════════════════════════════════════════════════════
//  2. NAVEGAÇÃO
// ════════════════════════════════════════════════════════════
window.showPage = function(pageName) {
  const url = PAGE_MAP[pageName];
  if (url) window.location.href = url;
};
window.goBack = function() { history.back(); };

// ════════════════════════════════════════════════════════════
//  3. TOAST
// ════════════════════════════════════════════════════════════
window.showToast = function(msgOrIcon, typeOrMsg="info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const TYPES = ["success","error","info","warning"];
  let msg, icon;
  if (TYPES.includes(typeOrMsg)) {
    msg  = msgOrIcon;
    icon = {success:"✅",error:"❌",info:"ℹ️",warning:"⚠️"}[typeOrMsg];
  } else {
    icon = msgOrIcon; msg = typeOrMsg;
  }
  const toast = document.createElement("div");
  toast.className = "toast toast-info";
  toast.setAttribute("role","alert");
  toast.innerHTML = `<span>${icon}</span> ${msg}`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-show"));
  setTimeout(() => {
    toast.classList.remove("toast-show");
    toast.addEventListener("transitionend", () => toast.remove(), {once:true});
  }, 4000);
};

// ════════════════════════════════════════════════════════════
//  4. FIRESTORE
// ════════════════════════════════════════════════════════════
async function upsertUserDoc(user, extra={}) {
  const ref  = doc(db,"users",user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid:user.uid, displayName:extra.displayName??user.displayName??"Anônimo",
      email:user.email??null, avatar:extra.avatar??"gato",
      interests:extra.interests??[], comfortLevel:extra.comfortLevel??"low",
      provider:extra.provider??"email", googleId:user.providerData?.[0]?.uid??null,
      createdAt:serverTimestamp(), lastLogin:serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {lastLogin:serverTimestamp()});
  }
}

window.fetchCurrentUserDoc = async function() {
  if (!currentUser) return null;
  const snap = await getDoc(doc(db,"users",currentUser.uid));
  return snap.exists() ? snap.data() : null;
};

// ════════════════════════════════════════════════════════════
//  5. AUTENTICAÇÃO
// ════════════════════════════════════════════════════════════
window.quickLogin = async function(event) {
  const label = (event?.currentTarget??event?.target)?.getAttribute("aria-label")??"";
  if      (label.includes("Google"))  await loginWithGoogle();
  else if (label.includes("anônim")) await loginAnonymously_();
  else                                await loginWithEmail();
};

async function loginWithEmail() {
  const email = document.getElementById("loginEmail")?.value.trim();
  const pass  = document.getElementById("loginPass")?.value;
  const btn   = document.querySelector('[aria-label="Entrar com e-mail"]');
  clearFieldError("loginEmail"); clearFieldError("loginPass");
  let ok = true;
  if (!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setFieldError("loginEmail","E-mail inválido.");ok=false;}
  if (!pass||pass.length<6){setFieldError("loginPass","Mínimo 6 caracteres.");ok=false;}
  if (!ok) return;
  setButtonLoading(btn,true,"Entrando…");
  try {
    const c = await signInWithEmailAndPassword(auth,email,pass);
    await upsertUserDoc(c.user,{provider:"email"});
    showToast("Bem-vindo(a) de volta! 🌟","success");
  } catch(e){ showToast(translateAuthError(e.code),"error"); }
  finally    { setButtonLoading(btn,false); }
}

async function loginWithGoogle() {
  const btn = document.querySelector('[aria-label="Entrar com Google"]');
  setButtonLoading(btn,true,"Conectando ao Google…");
  try {
    const r = await signInWithPopup(auth,googleProvider);
    await upsertUserDoc(r.user,{provider:"google",displayName:r.user.displayName});
    showToast(`Olá, ${r.user.displayName?.split(" ")[0]??"você"}! 🌿`,"success");
  } catch(e) {
    if (e.code!=="auth/popup-closed-by-user") showToast(translateAuthError(e.code),"error");
  } finally { setButtonLoading(btn,false); }
}

async function loginAnonymously_() {
  const btn = document.querySelector('[aria-label="Entrar anonimamente"]');
  setButtonLoading(btn,true,"Criando sessão…");
  try {
    const c = await signInAnonymously(auth);
    await upsertUserDoc(c.user,{provider:"anonymous",displayName:gerarNomeAnonimo(),avatar:"gato"});
    showToast("Entrando como anônimo 🌙","info");
  } catch(e){ showToast(translateAuthError(e.code),"error"); }
  finally    { setButtonLoading(btn,false); }
}

window.logout = async function() {
  try { await signOut(auth); window.location.href="login.html"; }
  catch { showToast("Erro ao sair.","error"); }
};

// ════════════════════════════════════════════════════════════
//  6. REGISTRO
// ════════════════════════════════════════════════════════════
window.completeRegister = async function() {
  const btn   = document.querySelector(".btn-primary");
  const name  = document.getElementById("regName")?.value.trim();
  const email = document.getElementById("regEmail")?.value.trim();
  const pass  = document.getElementById("regPass")?.value;
  clearFieldError("regName"); clearFieldError("regEmail"); clearFieldError("regPass");
  let ok = true;
  if (!name||name.length<2){setFieldError("regName","Mínimo 2 caracteres.");ok=false;}
  if (!selectedAvatar){showToast("Escolha um avatar! 🎨","error");ok=false;}
  if (email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setFieldError("regEmail","E-mail inválido.");ok=false;}
  if (email&&pass&&pass.length<6){setFieldError("regPass","Mínimo 6 caracteres.");ok=false;}
  if (!ok) return;
  setButtonLoading(btn,true,"Criando…");
  try {
    let c;
    if (email&&pass) { c=await createUserWithEmailAndPassword(auth,email,pass); await updateProfile(c.user,{displayName:name}); }
    else             { c=await signInAnonymously(auth); }
    await upsertUserDoc(c.user,{displayName:name,email:email??null,avatar:selectedAvatar,interests:selectedInterests,comfortLevel:selectedComfort,provider:email?"email":"anonymous"});
    showToast(`Conta criada! Bem-vindo(a), ${name}! 🌟`,"success");
  } catch(e){ showToast(translateAuthError(e.code),"error"); }
  finally    { setButtonLoading(btn,false); }
};

// ════════════════════════════════════════════════════════════
//  7. TEMA E CONFIGURAÇÕES
// ════════════════════════════════════════════════════════════
window.toggleTheme = function() {
  const dark = document.documentElement.dataset.theme==="dark";
  document.documentElement.dataset.theme = dark?"light":"dark";
  localStorage.setItem("theme",document.documentElement.dataset.theme);
  const btn = document.getElementById("themeBtn")??document.getElementById("darkToggle");
  if (btn){btn.textContent=dark?"🌙":"☀️"; btn.setAttribute("aria-checked",String(!dark));}
};
window.toggleSensory  = function(){_toggle("sensory-mode","sensoryToggle","sensory")};
window.toggleContrast = function(){_toggle("high-contrast","contrastToggle","contrast")};
window.toggleDyslexia = function(){_toggle("dyslexia-font","dyslexiaToggle","dyslexia")};
window.toggleMotion   = function(){_toggle("reduce-motion","motionToggle","motion")};
function _toggle(cls,btnId,key){
  document.body.classList.toggle(cls);
  const on=document.body.classList.contains(cls);
  const b=document.getElementById(btnId);
  if(b)b.setAttribute("aria-checked",String(on));
  localStorage.setItem(key,on);
}
window.toggleSound  = function(){_toggleBtn("soundToggle","sound")};
window.toggleSilent = function(){_toggleBtn("silentToggle","silent")};
function _toggleBtn(id,key){
  const b=document.getElementById(id);
  const on=b?.getAttribute("aria-checked")==="true";
  if(b)b.setAttribute("aria-checked",String(!on));
  localStorage.setItem(key,!on);
}
window.setAmbient = function(type){
  ["none","rain","waves","forest"].forEach(t=>{
    const b=document.getElementById(`ambient-${t}`);
    if(b){b.classList.toggle("active",t===type);b.setAttribute("aria-checked",String(t===type));}
  });
  showToast(type==="none"?"Som desativado":"Som: "+type,"info");
};
window.changeFontSize = function(delta){
  const cur=parseFloat(localStorage.getItem("fontSize")??"16");
  const next=Math.min(24,Math.max(12,cur+delta));
  document.documentElement.style.fontSize=next+"px";
  localStorage.setItem("fontSize",next);
};

// ════════════════════════════════════════════════════════════
//  8. DASHBOARD
// ════════════════════════════════════════════════════════════
const GAMES_DATA = [
  {id:"draw",  emoji:"🎨",title:"Desenho Colaborativo",desc:"Criem juntos em 5 min", time:"5 min",color:"var(--blue-pale)"},
  {id:"story", emoji:"📖",title:"História Coletiva",    desc:"Escrevam uma história",time:"3 min",color:"var(--purple-pale)"},
  {id:"quiz",  emoji:"🧩",title:"Quiz Cultural",        desc:"Respondam em equipe",  time:"3 min",color:"var(--green-pale)"},
  {id:"puzzle",emoji:"🖼️",title:"Quebra-Cabeça Coop",  desc:"Montem juntos",        time:"4 min",color:"#FFF3E0"},
  {id:"emoji", emoji:"😄",title:"Adivinhe o Emoji",     desc:"Descubram o emoji",   time:"2 min",color:"#FCE4EC"},
];
const FRIENDS_DATA = [
  {emoji:"🦊",name:"Lucas",status:"Jogando 🎮"},
  {emoji:"🐢",name:"Pedro",status:"Online 💚"},
  {emoji:"🦋",name:"Marina",status:"Modo quieto 🌙"},
];
const ACHIEVEMENTS_DATA = [
  {emoji:"🤝",name:"Primeira Conexão",  desc:"Completou sua 1ª sessão!",     unlocked:true},
  {emoji:"📖",name:"Historiador Gentil",desc:"Escreveu uma história completa",unlocked:true},
  {emoji:"🌙",name:"Parceiro Calmo",    desc:"10 sessões no modo silencioso", unlocked:true},
  {emoji:"🌺",name:"Jardim Florido",    desc:"5 conexões diferentes",         unlocked:false},
  {emoji:"🏆",name:"Cooperador Estelar",desc:"50 sessões completadas",        unlocked:false},
  {emoji:"🌈",name:"Arco-Íris",         desc:"Jogou todos os mini-games",     unlocked:false},
];

window.setMood = function(mood){
  const msgs={great:"Que ótimo! 🎉",good:"Perfeito 😊",ok:"Estamos aqui 🌿",tired:"Descanse 🌙",quiet:"Modo quieto ativado 🌙"};
  showToast(msgs[mood]??"🌟","info");
};

function renderGamesGrid(id, limit=999) {
  const grid=document.getElementById(id); if(!grid)return;
  grid.innerHTML=GAMES_DATA.slice(0,limit).map(g=>`
    <div class="game-card" role="listitem" tabindex="0" style="cursor:pointer"
      onclick="openComfort('${g.id}')" onkeydown="if(event.key==='Enter')openComfort('${g.id}')">
      <div class="game-icon" style="background:${g.color}">${g.emoji}</div>
      <div class="game-info"><div class="game-title">${g.title}</div><div class="game-desc">${g.desc}</div></div>
      <div class="game-time">${g.time}</div>
    </div>`).join("");
}

function renderFriendsList(){
  const list=document.getElementById("friendsList"); if(!list)return;
  list.innerHTML=FRIENDS_DATA.map(f=>`
    <div class="friend-item" role="listitem">
      <div class="friend-avatar">${f.emoji}</div>
      <div class="friend-info"><div class="friend-name">${f.name}</div><div class="friend-status">${f.status}</div></div>
      <button class="btn btn-ghost btn-sm" onclick="showToast('Convite enviado para ${f.name}! 💌','success')">Convidar</button>
    </div>`).join("");
}

function renderAchievementsList(){
  const list=document.getElementById("achievementsList"); if(!list)return;
  list.innerHTML=ACHIEVEMENTS_DATA.map(a=>`
    <div class="achievement ${a.unlocked?"":"locked"}" role="listitem" title="${a.name}">
      <span class="achievement-icon">${a.unlocked?a.emoji:"🔒"}</span>
      <span class="achievement-name">${a.unlocked?a.name:"???"}</span>
      ${a.unlocked?`<span style="font-size:0.7rem;color:var(--text3);text-align:center">${a.desc}</span>`:""}
    </div>`).join("");
}

// ════════════════════════════════════════════════════════════
//  9. MODAL CONFORTO + JOGO
// ════════════════════════════════════════════════════════════
window.openComfort = function(gameId){
  currentGame=gameId;
  const m=document.getElementById("comfortModal"); if(m){m.style.display="flex";m.setAttribute("aria-hidden","false");}
};
window.closeComfort = function(){
  const m=document.getElementById("comfortModal"); if(m){m.style.display="none";m.setAttribute("aria-hidden","true");}
};
window.startGame = function(mode){
  closeComfort();
  if (mode==="ai"||mode==="silent") window.location.href=`gameroom.html?game=${currentGame}&mode=${mode}`;
  else                              window.location.href=`waiting.html?game=${currentGame}&mode=${mode}`;
};
window.leaveGame = function(){
  if(confirm("Sair do jogo?")) window.location.href="dashboard.html";
};

// ════════════════════════════════════════════════════════════
//  10. CHAT
// ════════════════════════════════════════════════════════════
window.sendChatMsg = function(){
  const input=document.getElementById("chatInput");
  const msg=input?.value.trim(); if(!msg)return;
  addChatMessage("Você",msg); input.value="";
  setTimeout(()=>addChatMessage("IA CATEA 🤖",gerarRespostaIA(msg)),800);
};
window.sendQuickReply = function(msg){
  addChatMessage("Você",msg);
  setTimeout(()=>addChatMessage("IA CATEA 🤖",gerarRespostaIA(msg)),800);
};
function addChatMessage(author,text){
  const area=document.getElementById("chatMessages"); if(!area)return;
  const d=document.createElement("div"); d.className="chat-msg";
  d.innerHTML=`<span class="chat-author">${author}:</span> ${text}`;
  area.appendChild(d); area.scrollTop=area.scrollHeight;
}
window.toggleChat = function(){document.getElementById("chatPanel")?.classList.toggle("minimized");};
function gerarRespostaIA(msg){
  const r=["Que ideia! 💙","Adorei! 😄","Muito criativo! 🎨","Vamos continuar! 🌟","Você é incrível! 🌸"];
  return r[Math.floor(Math.random()*r.length)];
}

// ════════════════════════════════════════════════════════════
//  11. CANVAS
// ════════════════════════════════════════════════════════════
let isDrawing=false,drawColor="#5BAED9",drawSize=4;
function initCanvas(){
  const canvas=document.getElementById("drawCanvas"); if(!canvas)return;
  const ctx=canvas.getContext("2d");
  const draw=(x,y)=>{if(!isDrawing)return;ctx.lineWidth=drawSize;ctx.lineCap="round";ctx.strokeStyle=drawColor;ctx.lineTo(x,y);ctx.stroke();};
  canvas.addEventListener("mousedown",e=>{isDrawing=true;ctx.beginPath();ctx.moveTo(e.offsetX,e.offsetY);});
  canvas.addEventListener("mousemove",e=>draw(e.offsetX,e.offsetY));
  canvas.addEventListener("mouseup",()=>{isDrawing=false;});
  canvas.addEventListener("mouseleave",()=>{isDrawing=false;});
  canvas.addEventListener("touchstart",e=>{e.preventDefault();isDrawing=true;const r=canvas.getBoundingClientRect();ctx.beginPath();ctx.moveTo(e.touches[0].clientX-r.left,e.touches[0].clientY-r.top);});
  canvas.addEventListener("touchmove",e=>{e.preventDefault();const r=canvas.getBoundingClientRect();draw(e.touches[0].clientX-r.left,e.touches[0].clientY-r.top);});
  canvas.addEventListener("touchend",()=>{isDrawing=false;});
}
window.setColor = function(c){drawColor=c;document.querySelectorAll(".color-dot").forEach(d=>{d.classList.toggle("selected",d.style.background===c);d.setAttribute("aria-checked",String(d.style.background===c));});};
window.setSize  = function(s){drawSize=s;document.querySelectorAll(".size-btn").forEach((b,i)=>{const sz=[4,10,20];b.classList.toggle("active",sz[i]===s);b.setAttribute("aria-pressed",String(sz[i]===s));});};
window.clearCanvas = function(){const c=document.getElementById("drawCanvas");c?.getContext("2d").clearRect(0,0,c.width,c.height);};

// ════════════════════════════════════════════════════════════
//  12. AVATAR / INTERESSES (REGISTRO)
// ════════════════════════════════════════════════════════════
function renderAvatarGrid(){
  const g=document.getElementById("avatarGrid"); if(!g)return;
  g.innerHTML=AVATARS.map(a=>`<button type="button" class="avatar-option" data-avatar="${a.id}" role="radio" aria-checked="false" aria-label="${a.label}" title="${a.label}" onclick="selectAvatar('${a.id}')"><span>${a.emoji}</span></button>`).join("");
}
window.selectAvatar = function(id){
  selectedAvatar=id;
  document.querySelectorAll(".avatar-option").forEach(b=>{const s=b.dataset.avatar===id;b.classList.toggle("selected",s);b.setAttribute("aria-checked",String(s));});
};
function renderInterestsGrid(){
  const g=document.getElementById("interestsGrid"); if(!g)return;
  g.innerHTML=INTERESTS_LIST.map(i=>`<button type="button" class="tag" data-interest="${i.id}" role="checkbox" aria-checked="false" aria-label="${i.label}" onclick="toggleInterest('${i.id}')">${i.emoji} ${i.label}</button>`).join("");
}
window.toggleInterest = function(id){
  const btn=document.querySelector(`[data-interest="${id}"]`);
  if(selectedInterests.includes(id)){selectedInterests=selectedInterests.filter(i=>i!==id);btn?.classList.remove("active");btn?.setAttribute("aria-checked","false");}
  else{if(selectedInterests.length>=MAX_INTERESTS){showToast(`Máximo ${MAX_INTERESTS}! 🌈`,"error");return;}selectedInterests.push(id);btn?.classList.add("active");btn?.setAttribute("aria-checked","true");}
};
window.setComfortLevel = function(level){
  selectedComfort=level;
  ["low","med","high"].forEach(l=>{const b=document.getElementById(`comfort-${l}`);const a=l===level||(level==="medium"&&l==="med");b?.classList.toggle("active",a);b?.setAttribute("aria-checked",String(a));});
};

// ════════════════════════════════════════════════════════════
//  13. ATUALIZA UI COM DADOS DO USUÁRIO
// ════════════════════════════════════════════════════════════
async function loadUserUI(user){
  try {
    const data=await window.fetchCurrentUserDoc(); if(!data)return;
    const AVATAR_MAP=Object.fromEntries(AVATARS.map(a=>[a.id,a.emoji]));
    const em=AVATAR_MAP[data.avatar]??"🦋";
    document.querySelectorAll(".nav-avatar,.dash-avatar-lg,.profile-avatar").forEach(el=>el.textContent=em);
    const g=document.getElementById("dashGreeting"); if(g)g.textContent=`Olá, ${data.displayName}! 🌟`;
    const n=document.querySelector(".profile-name"); if(n)n.textContent=data.displayName;
  } catch(e){ /* silencia */ }
}

// ════════════════════════════════════════════════════════════
//  14. HELPERS DE FORMULÁRIO
// ════════════════════════════════════════════════════════════
function setButtonLoading(btn,loading,text="Aguarde…"){
  if(!btn)return;
  if(loading){btn._orig=btn.innerHTML;btn.innerHTML=`<span class="spinner"></span> ${text}`;btn.disabled=true;}
  else{btn.innerHTML=btn._orig??btn.innerHTML;btn.disabled=false;}
}
function setFieldError(id,msg){
  const el=document.getElementById(id); if(!el)return;
  el.classList.add("input-error");
  let e=document.getElementById(`${id}-error`);
  if(!e){e=document.createElement("p");e.id=`${id}-error`;e.className="field-error";el.parentNode.appendChild(e);}
  e.textContent=msg;
}
function clearFieldError(id){
  document.getElementById(id)?.classList.remove("input-error");
  const e=document.getElementById(`${id}-error`); if(e)e.textContent="";
}

// ════════════════════════════════════════════════════════════
//  15. UTILITÁRIOS
// ════════════════════════════════════════════════════════════
function translateAuthError(code){
  const m={"auth/email-already-in-use":"E-mail já cadastrado.","auth/invalid-email":"E-mail inválido.","auth/weak-password":"Senha fraca (mín. 6 chars).","auth/user-not-found":"Conta não encontrada.","auth/wrong-password":"Senha incorreta.","auth/invalid-credential":"E-mail ou senha incorretos.","auth/too-many-requests":"Muitas tentativas. Tente mais tarde.","auth/network-request-failed":"Sem conexão.","auth/popup-blocked":"Pop-up bloqueado. Permita para este site."};
  return m[code]??"Erro inesperado. Tente novamente.";
}
function gerarNomeAnonimo(){
  const a=["Calmo","Curioso","Sereno","Gentil","Alegre"],b=["Gato","Panda","Raposa","Coelho","Urso"];
  return `${a[Math.random()*a.length|0]}${b[Math.random()*b.length|0]}${100+(Math.random()*900|0)}`;
}

// ════════════════════════════════════════════════════════════
//  16. GAMEROOM — TIMER + MINI-GAMES
// ════════════════════════════════════════════════════════════
function startTimer(seconds){
  const d=document.getElementById("timerDisplay"); if(!d)return;
  let r=seconds;
  const iv=setInterval(()=>{r--;const m=Math.floor(r/60),s=r%60;d.textContent=`${m}:${s.toString().padStart(2,"0")}`;if(r<=0){clearInterval(iv);showToast("Sessão encerrada! Ótima participação! 🌟","success");setTimeout(()=>window.location.href="dashboard.html",2000);}},1000);
}
function loadGame(gameId){
  const t=document.getElementById("currentGameTitle");
  const games={draw:{title:"🎨 Desenho Colaborativo",show:"canvasGame",tools:true},story:{title:"📖 História Coletiva",show:"storyGame",tools:false},quiz:{title:"🧩 Quiz Cultural",show:"quizGame",tools:false},puzzle:{title:"🖼️ Quebra-Cabeça",show:"puzzleGame",tools:false},emoji:{title:"😄 Adivinhe o Emoji",show:"emojiGame",tools:false}};
  const g=games[gameId]??games.draw;
  if(t)t.textContent=g.title;
  ["canvasGame","storyGame","quizGame","puzzleGame","emojiGame"].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display="none";});
  const target=document.getElementById(g.show); if(target)target.style.display="flex";
  const tools=document.getElementById("canvasTools"); if(tools)tools.style.display=g.tools?"flex":"none";
  if(gameId==="quiz") initQuiz();
  if(gameId==="story")initStory();
  if(gameId==="emoji")initEmoji();
}

// Quiz
const QUIZ_Q=[{q:"Qual emoji é felicidade?",opts:["😢","😄","😴","😠"],a:1},{q:"Animal do oceano?",opts:["🦁","🐘","🐬","🦊"],a:2},{q:"O que é 🌈?",opts:["Chuva","Arco-íris","Vento","Neve"],a:1}];
let quizIdx=0;
function initQuiz(){showQuizQ();}
function showQuizQ(){
  const qEl=document.getElementById("quizQuestion"),optsEl=document.getElementById("quizOptions"); if(!qEl||!optsEl)return;
  const q=QUIZ_Q[quizIdx%QUIZ_Q.length]; qEl.textContent=q.q;
  optsEl.innerHTML=q.opts.map((o,i)=>`<button class="quiz-option" onclick="checkQuiz(${i},${q.a})">${o}</button>`).join("");
}
window.checkQuiz=function(chosen,correct){showToast(chosen===correct?"Correto! 🎉":"Quase! 💙",chosen===correct?"success":"error");quizIdx++;setTimeout(showQuizQ,1500);};

// Story
const STORY_SUGS=["De repente, uma luz apareceu…","E então eles descobriram…","No meio da floresta encantada…","O misterioso personagem disse…"];
function initStory(){renderStorySugs();addChatMessage("IA CATEA 🤖","Vamos criar uma história juntos! Você começa 🌟");}
function renderStorySugs(){const el=document.getElementById("storySuggestions");if(!el)return;el.innerHTML=STORY_SUGS.map(s=>`<button class="story-sug" onclick="useSuggestion('${s.replace(/'/g,"\\'")}')">💡 ${s}</button>`).join("");}
window.useSuggestion=function(t){const i=document.getElementById("storyInput");if(i){i.value=t;i.focus();}};
window.addStoryLine=function(){const i=document.getElementById("storyInput"),t=i?.value.trim();if(!t)return;const a=document.getElementById("storyArea");if(a)a.innerHTML+=`<p><strong>Você:</strong> ${t}</p>`;i.value="";setTimeout(()=>{const s=STORY_SUGS[Math.floor(Math.random()*STORY_SUGS.length)];if(a)a.innerHTML+=`<p><strong>IA:</strong> ${s}</p>`;a.scrollTop=a.scrollHeight;},1000);};

// Emoji
const EMOJI_R=[{emojis:"🎬🦁👑",hint:"Um filme famoso",answer:"rei leão"},{emojis:"❄️👸🏰",hint:"Filme de princesa",answer:"frozen"},{emojis:"🕷️🕸️👨",hint:"Super-herói",answer:"homem aranha"}];
let emojiIdx=0;
function initEmoji(){showEmojiR();}
function showEmojiR(){const r=EMOJI_R[emojiIdx%EMOJI_R.length];const d=document.getElementById("emojiDisplay"),h=document.getElementById("emojiHint");if(d)d.textContent=r.emojis;if(h)h.textContent=r.hint;}
window.checkEmojiAnswer=function(){const i=document.getElementById("emojiAnswer"),a=i?.value.trim().toLowerCase(),c=EMOJI_R[emojiIdx%EMOJI_R.length].answer;if(a===c){showToast("Acertou! 🎉","success");emojiIdx++;if(i)i.value="";setTimeout(showEmojiR,1500);}else{showToast("Quase! 💙","error");}};

// ════════════════════════════════════════════════════════════
//  17. INICIALIZAÇÃO
// ════════════════════════════════════════════════════════════
function applyStoredSettings(){
  const t=localStorage.getItem("theme"); if(t)document.documentElement.dataset.theme=t;
  if(localStorage.getItem("sensory")==="true") document.body.classList.add("sensory-mode");
  if(localStorage.getItem("contrast")==="true")document.body.classList.add("high-contrast");
  if(localStorage.getItem("dyslexia")==="true")document.body.classList.add("dyslexia-font");
  if(localStorage.getItem("motion")==="true")  document.body.classList.add("reduce-motion");
  const fs=localStorage.getItem("fontSize"); if(fs)document.documentElement.style.fontSize=fs+"px";
}

document.addEventListener("DOMContentLoaded",()=>{
  applyStoredSettings();
  const page=document.body.dataset.page;

  if (page==="register"){
    renderAvatarGrid(); renderInterestsGrid(); setComfortLevel("low");
    document.getElementById("regEmail")?.addEventListener("input",function(){
      const p=document.getElementById("passGroup"); if(p)p.style.display=this.value.trim()?"block":"none";
    });
  }
  if (page==="dashboard"){ renderGamesGrid("dashGames",3); renderFriendsList(); }
  if (page==="games")     { renderGamesGrid("allGamesGrid"); }
  if (page==="achievements"){ renderAchievementsList(); }
  if (page==="gameroom")  {
    initCanvas();
    const params=new URLSearchParams(window.location.search);
    loadGame(params.get("game")??"draw");
    startTimer(5*60);
  }
  if (page==="login"){
    document.getElementById("loginPass")?.addEventListener("keydown",e=>{if(e.key==="Enter")loginWithEmail();});
  }
});
