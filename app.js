import {LocalProvider,ServerProvider,loadServerConnection,saveServerConnection,wipeServerSecrets,validateBackup} from "./providers.js";

const $=id=>document.getElementById(id);
const config=window.APP_CONFIG||{buildTarget:"shared",version:"1.0.0",defaultApiUrl:"",allowLocalMode:true};
let provider=null, currentMode="local", games=[], serverConfig=null, aiEnabled=false;

function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function nl2br(s){return esc(s).replace(/\n/g,"<br>");}
function modeLabel(){return currentMode==="server"?"Server":"Lokal";}
function isDocker(){return config.buildTarget==="docker";}
function selectedMode(){return isDocker()?"server":(localStorage.getItem("brettspielregal-mode")||"");}
function setModeValue(mode){if(!isDocker())localStorage.setItem("brettspielregal-mode",mode);currentMode=mode;}
function setBusy(button,busy,label="Bitte warten …"){if(!button)return; if(busy){button.dataset.oldText=button.textContent;button.textContent=label;button.disabled=true;}else{button.textContent=button.dataset.oldText||button.textContent;button.disabled=false;}}
function showBanner(message,type="info"){const el=$("statusBanner");if(!message){el.className="status-banner hidden";el.textContent="";return;}el.className=`status-banner${type==="error"?" error":""}`;el.textContent=message;}
function showMessage(title,message){$("messageTitle").textContent=title;$("messageBody").innerHTML=`<p>${nl2br(message)}</p>`;$("messageDialog").showModal();}
function normalizeUrl(url){return (url||"").trim().replace(/\/$/,"");}
function inputNumber(id){const v=$(id).value;return v===""?null:Number(v);}

async function makeServerProvider(){
  if(isDocker())return new ServerProvider("");
  const c=await loadServerConnection();
  const url=normalizeUrl(c.url||config.defaultApiUrl||"");
  if(!url)throw new Error("Für den Server-Modus ist noch keine Backend-URL eingerichtet.");
  const origin=new URL(url).origin;
  const allow=Array.isArray(config.allowedServerOrigins)?config.allowedServerOrigins:[];
  if(allow.length&&!allow.includes(origin))throw new Error("Diese Backend-Origin ist in der Frontend-Konfiguration nicht freigegeben.");
  return new ServerProvider(url,{clientId:c.clientId||"",clientSecret:c.clientSecret||""});
}
async function selectProvider(){
  currentMode=selectedMode()||"local";
  provider=currentMode==="local"?new LocalProvider():await makeServerProvider();
  $("modeBadge").textContent=modeLabel();
  document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("selected",b.dataset.mode===currentMode));
  $("transferControls").classList.toggle("hidden",isDocker());
  $("modeChooser").classList.toggle("hidden",isDocker()||!config.allowLocalMode);
}

async function refreshConfig(){
  try{const c=await provider.config();$("appTitle").textContent=c.title||"Brettspielregal";aiEnabled=!!c.ai_import_enabled;}
  catch{aiEnabled=false;}
  $("aiImportRow").classList.toggle("hidden",currentMode!=="server"||!aiEnabled);
}
async function loadGames(){
  showBanner("");
  try{games=await provider.list();renderGames();}
  catch(err){games=[];renderGames();showBanner(err.message,"error");}
}
function renderGames(){
  const q=$("searchInput").value.trim().toLocaleLowerCase("de");
  const filtered=games.filter(g=>!q||[g.title,g.description,g.publisher,g.notes,...(g.tags||[])].join(" ").toLocaleLowerCase("de").includes(q));
  $("collectionCount").textContent=`${games.length} ${games.length===1?"Spiel":"Spiele"}`;
  $("emptyState").classList.toggle("hidden",games.length!==0);
  const list=$("gameList");list.innerHTML="";
  for(const g of filtered){
    const card=document.createElement("article");card.className="game-card";
    const meta=[];
    if(g.min_players||g.max_players)meta.push(`${g.min_players||"?"}–${g.max_players||g.min_players||"?"} Spieler`);
    if(g.play_time_min)meta.push(`${g.play_time_min} Min.`);
    if(g.min_age!==null&&g.min_age!==undefined)meta.push(`ab ${g.min_age}`);
    if(g.publisher)meta.push(g.publisher);
    if(g.year)meta.push(String(g.year));
    for(const tag of (g.tags||[]).slice(0,3))meta.push(tag);
    card.innerHTML=`<button class="card-hit" type="button"><div class="game-title-row"><h3>${esc(g.title)}</h3><span aria-hidden="true">›</span></div>${g.description?`<p class="game-description">${esc(g.description)}</p>`:""}<div class="game-meta">${meta.map(x=>`<span class="chip">${esc(x)}</span>`).join("")}</div></button>`;
    card.querySelector("button").addEventListener("click",()=>openGame(g));list.append(card);
  }
  if(games.length&&filtered.length===0)list.innerHTML='<div class="empty-state"><strong>Nichts gefunden</strong><p>Versuche einen anderen Suchbegriff.</p></div>';
}

function clearGameForm(){
  for(const id of ["gameId","titleInput","sourceUrlInput","descriptionInput","minPlayersInput","maxPlayersInput","playTimeInput","minAgeInput","publisherInput","yearInput","tagsInput","rulesUrlInput","rulesTextInput","notesInput"])$(id).value="";
}
function openGame(game=null){
  clearGameForm();$("deleteGameButton").classList.toggle("hidden",!game);$("gameDialogTitle").textContent=game?"Spiel bearbeiten":"Spiel erfassen";
  if(game){
    $("gameId").value=game.id;$("titleInput").value=game.title||"";$("sourceUrlInput").value=game.source_url||"";$("descriptionInput").value=game.description||"";
    $("minPlayersInput").value=game.min_players??"";$("maxPlayersInput").value=game.max_players??"";$("playTimeInput").value=game.play_time_min??"";$("minAgeInput").value=game.min_age??"";
    $("publisherInput").value=game.publisher||"";$("yearInput").value=game.year??"";$("tagsInput").value=(game.tags||[]).join(", ");$("rulesUrlInput").value=game.rules_url||"";$("rulesTextInput").value=game.rules_text||"";$("notesInput").value=game.notes||"";
  }
  $("gameDialog").showModal();setTimeout(()=>$("titleInput").focus(),50);
}
function formGame(){return {title:$("titleInput").value.trim(),source_url:$("sourceUrlInput").value.trim(),description:$("descriptionInput").value.trim(),min_players:inputNumber("minPlayersInput"),max_players:inputNumber("maxPlayersInput"),play_time_min:inputNumber("playTimeInput"),min_age:inputNumber("minAgeInput"),publisher:$("publisherInput").value.trim(),year:inputNumber("yearInput"),tags:$("tagsInput").value.split(",").map(x=>x.trim()).filter(Boolean),rules_url:$("rulesUrlInput").value.trim(),rules_text:$("rulesTextInput").value.trim(),notes:$("notesInput").value.trim()};}

async function saveGame(event){
  event.preventDefault();const data=formGame();if(!data.title){showMessage("Titel fehlt","Bitte gib einen Titel ein.");return;}
  const submit=$("gameForm").querySelector('button[type="submit"]');setBusy(submit,true,"Speichere …");
  try{const id=$("gameId").value;if(id)await provider.update(id,data);else await provider.create(data);$("gameDialog").close();await loadGames();}
  catch(err){showMessage("Speichern fehlgeschlagen",err.message);}finally{setBusy(submit,false);}
}
async function removeGame(){const id=$("gameId").value;if(!id)return;if(!confirm("Dieses Brettspiel wirklich löschen?"))return;try{await provider.remove(id);$("gameDialog").close();await loadGames();}catch(err){showMessage("Löschen fehlgeschlagen",err.message);}}

async function aiImport(){
  const url=$("sourceUrlInput").value.trim();if(!url){showMessage("Link fehlt","Bitte zuerst einen HTTPS-Link zur Spielseite eintragen.");return;}
  if(currentMode!=="server"){showMessage("Nur im Server-Modus","Die Link-Auswertung läuft bewusst serverseitig, damit kein KI-API-Schlüssel im Browser gespeichert werden muss.");return;}
  const btn=$("aiImportButton");setBusy(btn,true,"Analysiere Link …");
  try{
    const srv=provider;const result=await srv.aiFromUrl(url);const d=result.game||{};
    const assign=(id,key)=>{if(d[key]!==null&&d[key]!==undefined&&d[key]!=="")$(id).value=Array.isArray(d[key])?d[key].join(", "):d[key];};
    assign("titleInput","title");assign("descriptionInput","description");assign("minPlayersInput","min_players");assign("maxPlayersInput","max_players");assign("playTimeInput","play_time_min");assign("minAgeInput","min_age");assign("publisherInput","publisher");assign("yearInput","year");assign("tagsInput","tags");assign("rulesUrlInput","rules_url");assign("rulesTextInput","rules_text");
    showMessage("Vorschlag übernommen",result.ai_used?"Die Seite wurde serverseitig abgerufen und mit der konfigurierten KI strukturiert. Bitte prüfe die vorgeschlagenen Angaben vor dem Speichern.":"Die Seite wurde serverseitig ausgewertet. Es ist keine KI konfiguriert; verfügbare Seitendaten wurden als Vorschlag übernommen.");
  }catch(err){showMessage("Link konnte nicht ausgewertet werden",err.message);}finally{setBusy(btn,false);}
}

function downloadJson(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const file=new File([blob],name,{type:"application/json"});if(navigator.share&&navigator.canShare?.({files:[file]})){return navigator.share({files:[file],title:"Brettspielregal Backup"}).catch(()=>fallbackDownload(blob,name));}fallbackDownload(blob,name);}
function fallbackDownload(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);}
async function exportCurrent(){try{const backup=await provider.exportData();await downloadJson(backup,`brettspielregal-${currentMode}-${new Date().toISOString().slice(0,10)}.json`);}catch(err){showMessage("Export fehlgeschlagen",err.message);}}
function strategyDialog(preview,context){
  return new Promise(resolve=>{
    $("strategyBody").innerHTML=`<p>${esc(context)}</p><p><strong>${preview.total}</strong> Datensätze im Import<br>${preview.new} neu · ${preview.conflicts} Konflikte · ${preview.same} unverändert</p><p class="hint">„Ersetzen“ löscht den aktuellen Zielbestand vor dem Import. „Zusammenführen“ behält andere Ziel-Datensätze; gleiche IDs aus dem Import werden übernommen.</p>`;
    const dlg=$("strategyDialog");
    const finish=v=>{cleanup();dlg.close();resolve(v);};
    const merge=()=>finish("merge"), replace=()=>finish("replace"), close=()=>finish(null);
    function cleanup(){$("mergeStrategyButton").removeEventListener("click",merge);$("replaceStrategyButton").removeEventListener("click",replace);$("closeStrategyButton").removeEventListener("click",close);dlg.removeEventListener("cancel",close);}
    $("mergeStrategyButton").addEventListener("click",merge);$("replaceStrategyButton").addEventListener("click",replace);$("closeStrategyButton").addEventListener("click",close);dlg.addEventListener("cancel",close);dlg.showModal();
  });
}
async function importFile(file){
  try{const backup=validateBackup(JSON.parse(await file.text()));const preview=await provider.previewImport(backup);const strategy=await strategyDialog(preview,"Backup in den aktuell aktiven Speicher importieren?");if(!strategy)return;await provider.importData(backup,strategy);await loadGames();showMessage("Import abgeschlossen",`${backup.data.games.length} Datensätze wurden verarbeitet.`);}catch(err){showMessage("Import fehlgeschlagen",err.message);}finally{$("importInput").value="";}
}
async function localToServer(){
  try{const local=new LocalProvider();const backup=await local.exportData();if(backup.data.games.length===0){showMessage("Keine lokalen Daten","Im lokalen Speicher sind keine Brettspiele vorhanden.");return;}const server=await makeServerProvider();const preview=await server.previewImport(backup);const strategy=await strategyDialog(preview,"Lokale Daten auf den Server übertragen? Der lokale Bestand bleibt dabei unverändert.");if(!strategy)return;await server.importData(backup,strategy);showMessage("Übertragung abgeschlossen",`${backup.data.games.length} lokale Datensätze wurden an den Server übertragen.`);if(currentMode==="server")await loadGames();}catch(err){showMessage("Übertragung fehlgeschlagen",err.message);}
}
async function serverToLocal(){
  try{const server=await makeServerProvider();const backup=await server.exportData();const local=new LocalProvider();const preview=await local.previewImport(backup);const strategy=await strategyDialog(preview,"Serverdaten lokal übernehmen? Vor einem Ersetzen empfiehlt sich ein Export des aktuellen lokalen Bestands.");if(!strategy)return;if(strategy==="replace"&&confirm("Vor dem Ersetzen jetzt ein lokales Sicherheitsbackup exportieren?")){const old=await local.exportData();await downloadJson(old,`brettspielregal-lokal-vor-restore-${new Date().toISOString().slice(0,10)}.json`);}await local.importData(backup,strategy);showMessage("Lokale Übernahme abgeschlossen",`${backup.data.games.length} Server-Datensätze wurden lokal übernommen.`);if(currentMode==="local")await loadGames();}catch(err){showMessage("Übernahme fehlgeschlagen",err.message);}
}

async function loadSetup(){
  serverConfig=await loadServerConnection();$("backendUrl").value=serverConfig.url||config.defaultApiUrl||"";$("cfClientId").value=serverConfig.clientId||"";$("cfClientSecret").value="";$("cfClientSecret").placeholder=serverConfig.clientSecret?"Gespeichert – zum Ersetzen neu eingeben":"Neu setzen oder leer lassen";
  $("versionLabel").textContent=config.version;$("buildTargetLabel").textContent=isDocker()?"Docker Fullstack Build":"GitHub Pages PWA Build";
  $("serverConfigForm").classList.toggle("hidden",isDocker());
}
async function saveConnection(event){event.preventDefault();const url=normalizeUrl($("backendUrl").value);if(url&&!/^https:\/\//i.test(url)){showMessage("Ungültige Backend-URL","Im externen Pages-Frontend ist nur eine öffentliche HTTPS-Backend-URL vorgesehen.");return;}await saveServerConnection({url,clientId:$("cfClientId").value.trim(),clientSecret:$("cfClientSecret").value});showMessage("Gespeichert","Die Server-Konfiguration wurde nur auf diesem Gerät gespeichert.");await loadSetup();if(currentMode==="server"){try{provider=await makeServerProvider();await refreshConfig();await loadGames();}catch{}}}
async function clearSecrets(){if(!confirm("Gespeicherte Cloudflare-Zugangsdaten auf diesem Gerät löschen?"))return;await wipeServerSecrets();await loadSetup();showMessage("Zugangsdaten gelöscht","Client ID und Client Secret wurden aus IndexedDB entfernt.");}
async function testConnection(){const b=$("testConnectionButton");setBusy(b,true,"Teste …");try{const srv=await makeServerProvider();const h=await srv.health();showMessage("Verbindung funktioniert",h.status==="ok"?"Backend ist erreichbar und meldet Status ok.":"Backend ist erreichbar.");}catch(err){showMessage("Verbindung fehlgeschlagen",err.message);}finally{setBusy(b,false);}}

async function switchMode(mode){
  if(isDocker()||!config.allowLocalMode)return;if(mode===currentMode)return;setModeValue(mode);
  try{await selectProvider();await refreshConfig();await loadGames();showMessage("Betriebsmodus gewechselt",`Aktiv ist jetzt: ${modeLabel()}. Es wurden keine Daten zwischen Lokal und Server übertragen.`);}catch(err){showMessage("Server-Modus noch nicht bereit",err.message);showView("setup");}
  await loadSetup();
}
function showView(view){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view${view[0].toUpperCase()+view.slice(1)}`));document.querySelectorAll(".nav-button").forEach(b=>b.classList.toggle("active",b.dataset.view===view));$("mainContent").focus();}

function bindEvents(){
  $("addGameButton").addEventListener("click",()=>openGame());$("emptyAddButton").addEventListener("click",()=>openGame());$("searchInput").addEventListener("input",renderGames);
  $("closeGameDialog").addEventListener("click",()=>$("gameDialog").close());$("cancelGameButton").addEventListener("click",()=>$("gameDialog").close());$("gameForm").addEventListener("submit",saveGame);$("deleteGameButton").addEventListener("click",removeGame);$("aiImportButton").addEventListener("click",aiImport);
  document.querySelectorAll(".nav-button").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>switchMode(b.dataset.mode)));
  $("serverConfigForm").addEventListener("submit",saveConnection);$("clearSecretsButton").addEventListener("click",clearSecrets);$("testConnectionButton").addEventListener("click",testConnection);$("exportButton").addEventListener("click",exportCurrent);$("importInput").addEventListener("change",e=>{if(e.target.files?.[0])importFile(e.target.files[0]);});$("localToServerButton").addEventListener("click",localToServer);$("serverToLocalButton").addEventListener("click",serverToLocal);
  const closeMsg=()=>$("messageDialog").close();$("closeMessageButton").addEventListener("click",closeMsg);$("messageOkButton").addEventListener("click",closeMsg);
  document.querySelectorAll("[data-first-mode]").forEach(b=>b.addEventListener("click",async()=>{$("firstRunDialog").close();setModeValue(b.dataset.firstMode);try{await selectProvider();await refreshConfig();await loadGames();}catch(err){showView("setup");showMessage("Server einrichten",err.message);}await loadSetup();}));
  window.addEventListener("online",()=>currentMode==="server"&&loadGames());window.addEventListener("offline",()=>currentMode==="server"&&showBanner("Offline: Im Server-Modus sind Schreibaktionen erst wieder nach erfolgreicher Verbindung möglich."));
}

async function init(){
  bindEvents();$("versionLabel").textContent=config.version;
  if("serviceWorker" in navigator){navigator.serviceWorker.register("./service-worker.js").catch(()=>{});}
  if(!isDocker()&&config.allowLocalMode&&!selectedMode()){
    currentMode="local";provider=new LocalProvider();$("modeBadge").textContent="Lokal";await loadSetup();$("firstRunDialog").showModal();return;
  }
  try{await selectProvider();await refreshConfig();await loadGames();}catch(err){currentMode="server";$("modeBadge").textContent="Server";showBanner(err.message,"error");showView("setup");}
  await loadSetup();
}
init();
