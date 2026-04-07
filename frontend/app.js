// Configurações iniciais
const API_BASE = '/api'; // ajusta se seu backend usar outro prefixo
// variáveis globais de estado do frontend
let barChart = null;
let lineChart = null;
let latestData = null;
let currentPeriod = localStorage.getItem('qd_period') || 'day';

function getPricePerKWh(){
  const v = parseFloat(localStorage.getItem('qd_pricePerKWh'));
  return Number.isFinite(v) && v > 0 ? v : 0.8;
}

function setPricePerKWh(v){
  if(typeof v === 'number' && Number.isFinite(v) && v > 0){ localStorage.setItem('qd_pricePerKWh', String(v)); }
}

function $(id){return document.getElementById(id)}

function updateIndicators(data){
  $('total-watts').textContent = (data.totalWatts ?? 0) + ' W';
  $('daily-kwh').textContent = (data.dailyKwh ?? 0).toFixed(2) + ' kWh';
  $('cost').textContent = 'R$ ' + ((data.dailyKwh ?? 0) * getPricePerKWh()).toFixed(2);
  $('peak').textContent = (data.peak ?? 0) + ' W';
  const load = Math.min(100, Math.round((data.totalWatts ?? 0) / (data.maxCapacity ?? 5000) * 100));
  $('load-bar').style.width = load + '%';
  $('load-percent').textContent = load + '%';
}

function createCharts(){
  try{
    if(typeof Chart === 'undefined'){
      console.error('Chart.js não carregado. Verifique o <script> em index.html');
      const card = document.querySelector('.chart-card'); if(card) card.insertAdjacentHTML('afterbegin','<div style="color:#ffb3b3;padding:8px">Erro: Chart.js não carregado</div>');
      return;
    }
    const bEl = $('barChart'); if(!bEl){ console.warn('Elemento #barChart não encontrado'); return; }
    const bctx = bEl.getContext('2d');
  // paleta vibrante
  const palette = ['#FF6B6B','#FFB86B','#6BE5A8','#6BB8FF','#C86BFF','#FF6BB0'];
  barChart = new Chart(bctx, {
    type: 'bar',
    data: {labels: [], datasets:[{label:'W',backgroundColor:[],data:[]}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}
  });

    const lEl = $('lineChart'); if(!lEl){ console.warn('Elemento #lineChart não encontrado'); }
    const lctx = lEl ? lEl.getContext('2d') : null;
  // gradiente para a linha
    if(lctx){
      const grad = lctx.createLinearGradient(0,0,0,260);
      grad.addColorStop(0,'rgba(107,184,255,0.95)');
      grad.addColorStop(1,'rgba(107,229,168,0.6)');
      lineChart = new Chart(lctx, {
        type: 'line',
        data: {labels: [], datasets:[{label:'kWh',borderColor:grad,backgroundColor:'rgba(107,184,255,0.08)',fill:true,data:[]}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}
      });
    }
  }catch(e){ console.error('Erro ao criar gráficos', e); const card = document.querySelector('.chart-card'); if(card) card.insertAdjacentHTML('afterbegin','<div style="color:#ffb3b3;padding:8px">Erro ao criar gráficos: '+(e.message||e)+'</div>'); }
}

function updateCharts(data){
  // garante que os charts estão iniciados
  if(!barChart || !lineChart) createCharts();
  if(data.byDevice && data.byDevice.length){
    try{
      barChart.data.labels = data.byDevice.map(d=>d.name);
      barChart.data.datasets[0].data = data.byDevice.map(d=>Number(d.watts || 0));
      // aplicar cores cíclicas da paleta
      const palette = ['#FF6B6B','#FFB86B','#6BE5A8','#6BB8FF','#C86BFF','#FF6BB0'];
      barChart.data.datasets[0].backgroundColor = data.byDevice.map((_,i)=>palette[i % palette.length]);
      barChart.update();
    }catch(e){ console.warn('updateCharts (bar) falhou', e); }
  }else{
    // sem dados: limpar gráfico e exibir mensagem
    if(barChart){ barChart.data.labels = []; barChart.data.datasets[0].data = []; barChart.update(); }
    const grid = document.getElementById('rooms-grid'); if(grid) grid.innerHTML = '<div style="color:var(--muted)">Nenhum dado de cômodos disponível.</div>';
  }
  const series = data.dailySeriesForPeriod || data.dailySeries || [];
  if(series){
    lineChart.data.labels = series.map(p=>p.time);
    lineChart.data.datasets[0].data = series.map(p=>p.kwh);
    lineChart.update();
  }
}

function getSeriesForPeriod(data, period){
  // Se o backend fornecer séries por período, respeita; caso contrário, adapta demo dailySeries
  const src = data.dailySeries || [];
  if(period === 'day') return src;
  if(period === 'week'){
    // agregar em 7 pontos: somar 7 blocos do array (simulação)
    const out = [];
    for(let i=0;i<7;i++){
      const val = src[i % src.length]?.kwh || 1 + Math.random()*3;
      out.push({ time: ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][i], kwh: Number((val).toFixed(2)) });
    }
    return out;
  }
  if(period === 'month'){
    const out = [];
    for(let i=1;i<=12;i++) out.push({ time: String(i).padStart(2,'0') + '/M', kwh: Number((2 + Math.random()*6).toFixed(2)) });
    return out;
  }
  return src;
}

function checkAlerts(data){
  try{
    const user = getSessionUser();
    const prefs = user?.preferences || JSON.parse(localStorage.getItem('qd_alert_prefs') || 'null') || {};
    const enabled = prefs.enableAlert || false;
    const threshold = Number(prefs.thresholdKwh || localStorage.getItem('qd_threshold_kwh') || 0);
    const banner = document.getElementById('alert-banner');
    if(!banner) return;
    if(enabled && threshold > 0 && (data.dailyKwh ?? 0) > threshold){
      banner.style.display = 'block';
      // destacar custo
      const costEl = document.getElementById('cost'); if(costEl) costEl.classList.add('accent');
    }else{ banner.style.display = 'none'; const costEl = document.getElementById('cost'); if(costEl) costEl.classList.remove('accent'); }
  }catch(e){ console.warn('checkAlerts', e); }
}

function renderRoomPanels(data){
  const grid = document.getElementById('rooms-grid');
  if(!grid) return;
  grid.innerHTML = '';
  const items = (data.byDevice || []);
  items.forEach(item=>{
    const div = document.createElement('div');
    div.className = 'room-panel';
    const name = document.createElement('div'); name.className='room-name'; name.textContent = item.name;
    const watts = document.createElement('div'); watts.className='room-watts'; watts.textContent = (item.watts||0) + ' W';
    const detail = document.createElement('div'); detail.className='room-sub'; detail.textContent = (item.kwh? (item.kwh + ' kWh') : '—');
    div.appendChild(name); div.appendChild(watts); div.appendChild(detail);
    grid.appendChild(div);
  });
}



async function fetchData(){
  try{
    const res = await fetch(API_BASE + '/consumo');
    if(!res.ok) throw new Error('status ' + res.status);
    const json = await res.json();
    // adaptar séries conforme período selecionado
    json.dailySeriesForPeriod = getSeriesForPeriod(json, currentPeriod);
    updateIndicators(json);
    updateCharts(json);
    checkAlerts(json);
    renderRoomPanels(json);
    latestData = json;
    return json;
  }catch(err){
    console.warn('Não foi possível obter dados do backend:', err);
    // fallback demo
    const demo = {
      totalWatts: 850,
      dailyKwh: 12.34,
      peak: 1500,
      maxCapacity: 5000,
      byDevice: [
        {name:'Cozinha',watts:320},{name:'Sala',watts:220},{name:'Quarto',watts:80},{name:'Chuveiro',watts:230}
      ],
      dailySeries: [{time:'Manhã',kwh:3.2},{time:'Tarde',kwh:5.1},{time:'Noite',kwh:4.04}]
    };
    demo.dailySeriesForPeriod = getSeriesForPeriod(demo, currentPeriod);
    updateIndicators(demo); updateCharts(demo); checkAlerts(demo); renderRoomPanels(demo);
    latestData = demo;
    return demo;
  }
}

function exportCSV(data){
  const rows = [];
  rows.push(['Relatório','Consumo por Aparelho']);
  rows.push(['Data', new Date().toLocaleString()]);
  rows.push(['kWh diário', (data.dailyKwh ?? '').toString()]);
  rows.push(['Custo Estimado', 'R$ ' + (((data.dailyKwh ?? 0) * getPricePerKWh()).toFixed ? (data.dailyKwh ?? 0) * getPricePerKWh() : '')]);
  rows.push([]);
  rows.push(['Nome','Watts (W)']);
  (data.byDevice||[]).forEach(d=>rows.push([d.name,d.watts]));
  const csv = rows.map(r=>r.map(c=>typeof c === 'string' && c.includes(',')? '"'+c+'"' : c).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'consumo_por_aparelho.csv'; a.click();
  URL.revokeObjectURL(url);
  try{ notifyAfterExport(data); }catch(e){}
}

function createTableElement(data){
  const wrap = document.createElement('div');
  wrap.style.padding = '12px';
  wrap.style.background = '#fff';
  wrap.style.color = '#000';
  const title = document.createElement('h3'); title.textContent = 'Consumo por Aparelho'; title.style.margin='8px 0';
  // resumo com custo estimado
  const summary = document.createElement('div'); summary.style.marginBottom = '8px'; summary.style.fontSize = '14px';
  const when = document.createElement('div'); when.textContent = 'Data: ' + new Date().toLocaleString(); when.style.marginBottom='4px';
  const daily = document.createElement('div'); daily.textContent = 'kWh diário: ' + ((data.dailyKwh ?? 0).toFixed ? (data.dailyKwh ?? 0).toFixed(2) : (data.dailyKwh ?? 0)); daily.style.marginBottom='4px';
  const cost = document.createElement('div'); cost.textContent = 'Custo Estimado: R$ ' + (((data.dailyKwh ?? 0) * getPricePerKWh()).toFixed ? ((data.dailyKwh ?? 0) * getPricePerKWh()).toFixed(2) : '');
  summary.appendChild(when); summary.appendChild(daily); summary.appendChild(cost);
  wrap.appendChild(title);
  wrap.appendChild(summary);
  const table = document.createElement('table');
  table.style.borderCollapse='collapse'; table.style.width='100%';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  ['Nome','Watts (W)'].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; th.style.border='1px solid #ccc'; th.style.padding='6px 8px'; th.style.textAlign='left'; th.style.background='#f6f6f6'; hr.appendChild(th); });
  thead.appendChild(hr); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  (data.byDevice||[]).forEach(r=>{
    const tr = document.createElement('tr');
    const td1 = document.createElement('td'); td1.textContent = r.name; td1.style.border='1px solid #ddd'; td1.style.padding='6px 8px';
    const td2 = document.createElement('td'); td2.textContent = (r.watts||0); td2.style.border='1px solid #ddd'; td2.style.padding='6px 8px';
    tr.appendChild(td1); tr.appendChild(td2); tbody.appendChild(tr);
  });
  table.appendChild(tbody); wrap.appendChild(table);
  return wrap;
}

async function exportAsImageFromElement(el, filename, mime='image/jpeg'){
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
  const dataUrl = canvas.toDataURL(mime, 0.92);
  const a = document.createElement('a'); a.href = dataUrl; a.download = filename; a.click();
}

async function exportJPG(data){
  const el = createTableElement(data);
  // render off-screen
  el.style.position='fixed'; el.style.left='-9999px'; document.body.appendChild(el);
  try{ await exportAsImageFromElement(el, 'consumo_por_aparelho.jpg', 'image/jpeg'); }
  finally{ document.body.removeChild(el); }
  try{ notifyAfterExport(data); }catch(e){}
}

async function exportPDF(data){
  const el = createTableElement(data);
  el.style.position='fixed'; el.style.left='-9999px'; document.body.appendChild(el);
  try{
    // render resumo/tabela
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    const summaryData = canvas.toDataURL('image/jpeg', 0.95);
    const { jsPDF } = window.jspdf || {};
    const pdf = jsPDF ? new jsPDF('p','pt','a4') : null;
    if(!pdf){
      // fallback: download image if jsPDF not available
      const a = document.createElement('a'); a.href = summaryData; a.download = 'consumo_por_aparelho.jpg'; a.click();
      try{ notifyAfterExport(data); }catch(e){}
      return;
    }
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // helper to add an image to PDF scaled to page width with margins
    async function addImageToPdf(imgData, addNewPage){
      const img = new Image(); img.src = imgData;
      await new Promise((res)=>{ img.onload = res; });
      const margin = 28;
      const maxW = pageWidth - margin * 2;
      const ratio = img.width / img.height;
      const drawW = Math.min(maxW, img.width);
      const drawH = drawW / ratio;
      if(addNewPage) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, 20, drawW, drawH);
    }

    // adicionar resumo na primeira página
    await addImageToPdf(summaryData, false);

    // capturar gráficos (barChart e lineChart) se existirem e adicionar cada um em nova página
    try{
      const barCanvas = document.getElementById('barChart');
      const lineCanvas = document.getElementById('lineChart');
      const charts = [];
      if(barCanvas && typeof barCanvas.toDataURL === 'function') charts.push(barCanvas.toDataURL('image/jpeg', 0.95));
      if(lineCanvas && typeof lineCanvas.toDataURL === 'function') charts.push(lineCanvas.toDataURL('image/jpeg', 0.95));
      for(const imgData of charts){ await addImageToPdf(imgData, true); }
    }catch(e){ console.warn('Erro ao capturar gráficos para o PDF', e); }

    pdf.save('consumo_por_aparelho.pdf');
    try{ notifyAfterExport(data); }catch(e){}
  }finally{ document.body.removeChild(el); }
}

async function sendNotification(user, message){
  // tenta endpoint backend
  try{
    await fetch(API_BASE + '/notify', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ to: user.email, phone: user.phone, method: user.preferences?.notifyMethod, message }) });
    try{ alert('Notificação enviada (tentativa via backend).'); }catch(e){}
    return;
  }catch(e){}
  // fallback: abrir mailto / sms
  const method = user.preferences?.notifyMethod || 'email';
  const phone = (user.phone||'').replace(/\D/g,'');
  if((method === 'email' || method === 'both') && user.email){
    const subject = encodeURIComponent('Relatório — Quadro de Força');
    const body = encodeURIComponent(message);
    window.open(`mailto:${user.email}?subject=${subject}&body=${body}`);
  }
  if((method === 'sms' || method === 'both') && phone){
    const body = encodeURIComponent(message);
    window.open(`sms:${phone}?body=${body}`);
  }
  if(!( (method==='email' && user.email) || (method==='sms' && phone) || (method==='both' && (user.email || phone)) )){
    try{ alert('Não foi possível enviar notificação automaticamente. Contato ausente.'); }catch(e){}
  }
}

function notifyAfterExport(data){
  const user = getSessionUser();
  if(!user || !user.preferences || !user.preferences.autoSend) return;
  const cost = (((data.dailyKwh ?? 0) * getPricePerKWh()).toFixed ? ((data.dailyKwh ?? 0) * getPricePerKWh()).toFixed(2) : (data.dailyKwh ?? 0));
  const msg = `Relatório gerado em ${new Date().toLocaleString()}. Custo estimado: R$ ${cost}`;
  try{ sendNotification(user, msg); }catch(e){ console.warn('notifyAfterExport erro', e); }
}

/* ---------------- User menu / login (localStorage simple) ---------------- */
// ---------------- User menu / login / cadastro (localStorage simple) ----------------
function getSessionUser(){ try{ return JSON.parse(localStorage.getItem('qd_user') || 'null'); }catch(e){return null} }
function setSessionUser(u){ localStorage.setItem('qd_user', JSON.stringify(u)); }
function clearSessionUser(){ localStorage.removeItem('qd_user'); }

function getRegisteredUsers(){ try{ return JSON.parse(localStorage.getItem('qd_users') || '[]'); }catch(e){return []} }
function saveRegisteredUsers(list){ localStorage.setItem('qd_users', JSON.stringify(list)); }

function findUserByEmail(email){ const users = getRegisteredUsers(); return users.find(u=>u.email && u.email.toLowerCase() === (email||'').toLowerCase()); }

async function hashPassword(password){
  try{
    const enc = new TextEncoder().encode(password);
    const hash = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(e){ return btoa(password); }
}

function formatPhoneDigits(digits){
  const s = digits.replace(/\D/g,'');
  if(s.length===11) return `(${s.slice(0,2)}) ${s.slice(2,7)}-${s.slice(7)}`;
  if(s.length===10) return `(${s.slice(0,2)}) ${s.slice(2,6)}-${s.slice(6)}`;
  return digits;
}

function validatePhone(value){ const s = (value||'').replace(/\D/g,''); return s.length===10 || s.length===11; }

function renderUserPanel(){
  const panel = document.getElementById('user-panel');
  const user = getSessionUser();
  panel.innerHTML = '';
  if(user){
    const info = document.createElement('div'); info.className='info';
    const name = document.createElement('div'); name.className='u-name'; name.textContent = user.name || 'Usuário';
    const email = document.createElement('div'); email.className='u-email'; email.textContent = user.email || '';
    const phone = document.createElement('div'); phone.className='u-email small-note'; phone.textContent = user.phone ? formatPhoneDigits(user.phone) : '';
    info.appendChild(name); info.appendChild(email); if(user.phone) info.appendChild(phone);
    if(user.address){
      const addr = document.createElement('div'); addr.className='u-address small-note';
      addr.textContent = `${user.address.street}${user.address.number? ', ' + user.address.number: ''} — ${user.address.city}/${user.address.state} — CEP ${user.address.cep}`;
      info.appendChild(addr);
    }
    if(user.preferences){
      const pref = document.createElement('div'); pref.className='u-pref small-note'; pref.style.marginTop='6px';
      pref.textContent = `Envio automático: ${user.preferences.autoSend? 'Sim' : 'Não'} — Método: ${user.preferences.notifyMethod || 'email'}`;
      info.appendChild(pref);
    }
    const actions = document.createElement('div'); actions.className='user-actions';
    const btnLogout = document.createElement('button'); btnLogout.textContent='Sair'; btnLogout.addEventListener('click',()=>{ clearSessionUser(); updateUserButton(); renderUserPanel(); closeUserMenu(); });
    actions.appendChild(btnLogout);
    // preço do kWh (ajuste rápido)
    const priceWrap = document.createElement('div'); priceWrap.style.marginTop='8px';
    const priceLabel = document.createElement('label'); priceLabel.textContent = 'Preço kWh:'; priceLabel.style.marginRight='6px';
    const priceInput = document.createElement('input'); priceInput.type='number'; priceInput.step='0.01'; priceInput.min='0'; priceInput.value = getPricePerKWh(); priceInput.style.width='90px';
    const priceBtn = document.createElement('button'); priceBtn.type='button'; priceBtn.textContent='Salvar preço'; priceBtn.style.marginLeft='8px';
    priceBtn.addEventListener('click', ()=>{
      const v = parseFloat(priceInput.value);
      if(!Number.isFinite(v) || v <= 0){ alert('Informe um valor de preço válido.'); return; }
      setPricePerKWh(v); try{ fetchData(); }catch(e){};
    });
    priceWrap.appendChild(priceLabel); priceWrap.appendChild(priceInput); priceWrap.appendChild(priceBtn);
    actions.appendChild(priceWrap);
    // alertas inteligentes: configurar limite
    const alertWrap = document.createElement('div'); alertWrap.style.marginTop='8px'; alertWrap.style.display='flex'; alertWrap.style.gap='8px'; alertWrap.style.alignItems='center';
    const alertChk = document.createElement('input'); alertChk.type='checkbox'; alertChk.id='enable-alerts'; alertChk.checked = user.preferences?.enableAlert || (localStorage.getItem('qd_alert_enable')==='true');
    const alertLabel = document.createElement('label'); alertLabel.htmlFor='enable-alerts'; alertLabel.textContent = 'Ativar alertas';
    const threshInput = document.createElement('input'); threshInput.type='number'; threshInput.placeholder='Limite kWh'; threshInput.style.width='110px'; threshInput.value = (user.preferences?.thresholdKwh ?? localStorage.getItem('qd_threshold_kwh')) || '';
    const alertSave = document.createElement('button'); alertSave.type='button'; alertSave.textContent='Salvar alerta'; alertSave.style.marginLeft='6px';
    alertSave.addEventListener('click', ()=>{
      const enable = !!alertChk.checked;
      const thresh = Number(threshInput.value || 0);
      // persistir nas preferências do usuário (se existir) e em localStorage
      updateCurrentUserPreferences({ preferences: { ...(user.preferences||{}), enableAlert: enable, thresholdKwh: thresh } });
      localStorage.setItem('qd_alert_enable', enable ? 'true' : 'false');
      localStorage.setItem('qd_threshold_kwh', String(thresh));
      alert('Preferências de alerta salvas.');
      checkAlerts({ dailyKwh: latestData?.dailyKwh ?? 0 });
    });
    alertWrap.appendChild(alertChk); alertWrap.appendChild(alertLabel); alertWrap.appendChild(threshInput); alertWrap.appendChild(alertSave);
    actions.appendChild(alertWrap);
    // botão de teste de notificação
    const testBtn = document.createElement('button'); testBtn.type='button'; testBtn.textContent='Enviar notificação de teste'; testBtn.style.marginLeft='8px';
    testBtn.addEventListener('click', ()=>{
      const msg = `Teste de notificação: Relatório gerado em ${new Date().toLocaleString()}.`;
      sendNotification(user, msg);
    });
    actions.appendChild(testBtn);
    panel.appendChild(info); panel.appendChild(actions);
  }else{
    // Tabs: Login / Cadastrar
    const tabs = document.createElement('div'); tabs.className='toggle-forms';
    const bLogin = document.createElement('button'); bLogin.type='button'; bLogin.textContent='Entrar'; bLogin.className='active';
    const bReg = document.createElement('button'); bReg.type='button'; bReg.textContent='Cadastrar';
    tabs.appendChild(bLogin); tabs.appendChild(bReg);
    panel.appendChild(tabs);

    const cont = document.createElement('div'); cont.id='auth-forms'; panel.appendChild(cont);

    function activate(btn){ bLogin.classList.remove('active'); bReg.classList.remove('active'); btn.classList.add('active'); }
    bLogin.addEventListener('click',()=>{ activate(bLogin); showLoginForm(cont); });
    bReg.addEventListener('click',()=>{ activate(bReg); showRegisterForm(cont); });

    // default
    showLoginForm(cont);
  }
}

function updateCurrentUserPreferences(updates){
  try{
    const session = getSessionUser();
    if(!session || !session.email) return;
    const users = getRegisteredUsers();
    const idx = users.findIndex(u=>u.email && u.email.toLowerCase() === session.email.toLowerCase());
    if(idx >= 0){
      users[idx] = { ...users[idx], ...updates };
      saveRegisteredUsers(users);
      // update session store
      const merged = { ...session, ...(updates.preferences ? { preferences: updates.preferences } : {}) };
      setSessionUser(merged);
      renderUserPanel();
    }else{
      // se usuário não estiver cadastrado (fallback), apenas salvar prefs local
      if(updates.preferences){ localStorage.setItem('qd_alert_enable', updates.preferences.enableAlert ? 'true' : 'false'); localStorage.setItem('qd_threshold_kwh', String(updates.preferences.thresholdKwh || '')); }
    }
  }catch(e){ console.warn('updateCurrentUserPreferences', e); }
}

function updateUserButton(){
  const user = getSessionUser();
  const nameSpan = document.querySelector('.user-name');
  const avatar = document.querySelector('.user-avatar');
  if(user){
    nameSpan.textContent = (user.name||'').split(' ')[0] || 'Usuário';
    avatar.textContent = ((user.name||'U')[0] || 'U').toUpperCase();
  }else{ nameSpan.textContent = 'Entrar'; avatar.textContent = 'D'; }
}

function toggleUserMenu(){
  const menu = document.getElementById('user-menu');
  const btn = document.getElementById('user-btn');
  const showing = menu.classList.toggle('show');
  menu.setAttribute('aria-hidden', !showing);
  btn.setAttribute('aria-expanded', showing);
}
function closeUserMenu(){ const menu=document.getElementById('user-menu'); const btn=document.getElementById('user-btn'); if(menu){ menu.classList.remove('show'); menu.setAttribute('aria-hidden','true'); } if(btn) btn.setAttribute('aria-expanded','false'); }

function showLoginForm(container){
  container.innerHTML = '';
  const form = document.createElement('form'); form.className='login-form';
  form.innerHTML = `
    <input type="email" name="email" placeholder="Email" required />
    <input type="password" name="password" placeholder="Senha" required />
    <div style="display:flex;gap:8px;justify-content:flex-end"><button type="submit">Entrar</button></div>
  `;
  const err = document.createElement('div'); err.className='error-msg'; err.style.display='none'; container.appendChild(err);
  container.appendChild(form);
  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault(); err.style.display='none';
    const fd = new FormData(form); const email = fd.get('email'); const pwd = fd.get('password');
    const userRec = findUserByEmail(email);
    if(!userRec){ err.textContent='Usuário não encontrado.'; err.style.display='block'; return; }
    const h = await hashPassword(pwd);
    if(userRec.passwordHash !== h){ err.textContent='Senha incorreta.'; err.style.display='block'; return; }
    // set session (without passwordHash)
    const session = { name: userRec.name, email: userRec.email, phone: userRec.phone, address: userRec.address || null };
    setSessionUser(session); updateUserButton(); renderUserPanel(); closeUserMenu();
  });
}

function showRegisterForm(container){
  container.innerHTML = '';
  const form = document.createElement('form'); form.className='register-form';
  form.innerHTML = `
    <input type="text" name="name" placeholder="Nome completo" required />
    <div class="grid">
      <input type="text" name="phone" placeholder="Telefone (DDD)" required />
      <input type="email" name="email" placeholder="E-mail" required />
    </div>
    <div class="grid">
      <input type="text" name="cep" placeholder="CEP (somente números)" required />
      <input type="text" name="street" placeholder="Rua / Logradouro" required />
    </div>
    <div class="grid">
      <input type="text" name="number" placeholder="Número" />
      <input type="text" name="city" placeholder="Cidade" required />
    </div>
    <div class="grid">
      <input type="text" name="state" placeholder="Estado (UF)" required />
      <input type="password" name="password" placeholder="Senha (mín. 6)" required />
    </div>
    <div class="grid">
      <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" name="autoSend" /> Enviar relatório automaticamente</label>
      <div style="display:flex;gap:8px;align-items:center">
        <label><input type="radio" name="notifyMethod" value="email" checked /> E-mail</label>
        <label><input type="radio" name="notifyMethod" value="sms" /> Celular (SMS)</label>
        <label><input type="radio" name="notifyMethod" value="both" /> Ambos</label>
      </div>
    </div>
    <input type="password" name="password2" placeholder="Confirmar senha" required />
    <div style="display:flex;gap:8px;justify-content:flex-end"><button type="submit">Criar conta</button></div>
  `;
  const err = document.createElement('div'); err.className='error-msg'; err.style.display='none'; container.appendChild(err);
  container.appendChild(form);
  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault(); err.style.display='none';
    const fd = new FormData(form);
    const name = (fd.get('name')||'').trim(); let phone = (fd.get('phone')||'').trim(); const email = (fd.get('email')||'').trim(); const pwd = fd.get('password'); const pwd2 = fd.get('password2');
    const cep = (fd.get('cep')||'').replace(/\D/g,'');
    const street = (fd.get('street')||'').trim();
    const number = (fd.get('number')||'').trim();
    const city = (fd.get('city')||'').trim();
    const state = (fd.get('state')||'').trim();
    if(!name){ err.textContent='Nome é obrigatório.'; err.style.display='block'; return; }
    const phoneDigits = (phone||'').replace(/\D/g,'');
    if(!validatePhone(phone)){ err.textContent='Telefone inválido. Forneça DDD + número.'; err.style.display='block'; return; }
    if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ err.textContent='E-mail inválido.'; err.style.display='block'; return; }
    if(pwd.length < 6){ err.textContent='Senha muito curta (mínimo 6 caracteres).'; err.style.display='block'; return; }
    if(pwd !== pwd2){ err.textContent='As senhas não coincidem.'; err.style.display='block'; return; }
    if(findUserByEmail(email)){ err.textContent='Já existe uma conta com esse e-mail.'; err.style.display='block'; return; }
    if(!/^[0-9]{8}$/.test(cep)){ err.textContent='CEP inválido. Informe 8 dígitos.'; err.style.display='block'; return; }
    if(!street || !city || !state){ err.textContent='Preencha rua, cidade e estado.'; err.style.display='block'; return; }
    const autoSend = !!fd.get('autoSend');
    const notifyMethod = (fd.get('notifyMethod')||'email');
    if(autoSend){
      if(notifyMethod === 'email' && !email){ err.textContent='Para ativar envio por e-mail, informe um e-mail válido.'; err.style.display='block'; return; }
      if((notifyMethod === 'sms' || notifyMethod === 'both') && !phoneDigits){ err.textContent='Para ativar envio por SMS, informe telefone válido.'; err.style.display='block'; return; }
    }
    const h = await hashPassword(pwd);
    const users = getRegisteredUsers();
    const newUser = { name, phone: phoneDigits, email, passwordHash: h, address: { cep, street, number, city, state }, preferences: { autoSend, notifyMethod } };
    users.push(newUser); saveRegisteredUsers(users);
    // criar sessão sem expor hash
    setSessionUser({ name, email, phone: phoneDigits, address: newUser.address, preferences: newUser.preferences });
    updateUserButton(); renderUserPanel(); closeUserMenu();
  });
}

document.addEventListener('click',(e)=>{ const menu=document.getElementById('user-menu'); const btn=document.getElementById('user-btn'); if(!menu||!btn) return; if(btn.contains(e.target)) return; if(menu.contains(e.target)) return; closeUserMenu(); });

document.addEventListener('DOMContentLoaded',()=>{
  try{ window.scrollTo(0,0); }catch(e){}
  createCharts();
  fetchData().then(d=>latestData = d);
  setInterval(async ()=>{ latestData = await fetchData(); latestData = latestData; },5000);
  $('export-csv').addEventListener('click',()=>exportCSV(latestData || {}));
  const periodSel = document.getElementById('period-select');
  if(periodSel){ periodSel.value = currentPeriod; periodSel.addEventListener('change',(e)=>{ setPeriod(e.target.value); if(latestData){ latestData.dailySeriesForPeriod = getSeriesForPeriod(latestData, currentPeriod); updateCharts(latestData); } }); }
  const pdfBtn = document.getElementById('export-pdf');
  const jpgBtn = document.getElementById('export-jpg');
  if(pdfBtn) pdfBtn.addEventListener('click', ()=>exportPDF(latestData || {}));
  if(jpgBtn) jpgBtn.addEventListener('click', ()=>exportJPG(latestData || {}));

  const userBtn = document.getElementById('user-btn');
  if(userBtn){ userBtn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleUserMenu(); }); }
  updateUserButton(); renderUserPanel();
});
