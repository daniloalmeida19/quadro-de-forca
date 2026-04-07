// Configurações iniciais
const API_BASE = '/api'; // ajusta se seu backend usar outro prefixo

function getPricePerKWh(){
  const v = parseFloat(localStorage.getItem('qd_pricePerKWh'));
  return Number.isFinite(v) && v > 0 ? v : 0.8;
}
function setPricePerKWh(v){ localStorage.setItem('qd_pricePerKWh', String(v)); }

let barChart, lineChart;

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
  const bctx = $('barChart').getContext('2d');
  // paleta vibrante
  const palette = ['#FF6B6B','#FFB86B','#6BE5A8','#6BB8FF','#C86BFF','#FF6BB0'];
  barChart = new Chart(bctx, {
    type: 'bar',
    data: {labels: [], datasets:[{label:'W',backgroundColor:[],data:[]}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}
  });

  const lctx = $('lineChart').getContext('2d');
  // gradiente para a linha
  const grad = lctx.createLinearGradient(0,0,0,260);
  grad.addColorStop(0,'rgba(107,184,255,0.95)');
  grad.addColorStop(1,'rgba(107,229,168,0.6)');
  lineChart = new Chart(lctx, {
    type: 'line',
    data: {labels: [], datasets:[{label:'kWh',borderColor:grad,backgroundColor:'rgba(107,184,255,0.08)',fill:true,data:[]}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}
  });
}

function updateCharts(data){
  if(data.byDevice){
    barChart.data.labels = data.byDevice.map(d=>d.name);
    barChart.data.datasets[0].data = data.byDevice.map(d=>d.watts);
    // aplicar cores cíclicas da paleta
    const palette = ['#FF6B6B','#FFB86B','#6BE5A8','#6BB8FF','#C86BFF','#FF6BB0'];
    barChart.data.datasets[0].backgroundColor = data.byDevice.map((_,i)=>palette[i % palette.length]);
    barChart.update();
  }
  if(data.dailySeries){
    lineChart.data.labels = data.dailySeries.map(p=>p.time);
    lineChart.data.datasets[0].data = data.dailySeries.map(p=>p.kwh);
    lineChart.update();
  }
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
    updateIndicators(json);
    updateCharts(json);
    renderRoomPanels(json);
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
    updateIndicators(demo); updateCharts(demo); renderRoomPanels(demo);
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
}

async function exportPDF(data){
  const el = createTableElement(data);
  el.style.position='fixed'; el.style.left='-9999px'; document.body.appendChild(el);
  try{
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const { jsPDF } = window.jspdf || {};
    const pdf = jsPDF ? new jsPDF('p','pt','a4') : null;
    if(!pdf){
      // fallback: download image if jsPDF not available
      const a = document.createElement('a'); a.href = imgData; a.download = 'consumo_por_aparelho.jpg'; a.click();
      return;
    }
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const img = new Image(); img.src = imgData;
    await new Promise((res)=>{ img.onload = res; });
    const imgW = img.width; const imgH = img.height;
    const ratio = Math.min(pageWidth / imgW, pageHeight / imgH);
    const w = imgW * ratio; const h = imgH * ratio;
    pdf.addImage(imgData, 'JPEG', (pageWidth - w) / 2, 20, w, h);
    pdf.save('consumo_por_aparelho.pdf');
  }finally{ document.body.removeChild(el); }
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
    const h = await hashPassword(pwd);
    const users = getRegisteredUsers();
    const newUser = { name, phone: phoneDigits, email, passwordHash: h, address: { cep, street, number, city, state } };
    users.push(newUser); saveRegisteredUsers(users);
    // criar sessão sem expor hash
    setSessionUser({ name, email, phone: phoneDigits, address: newUser.address });
    updateUserButton(); renderUserPanel(); closeUserMenu();
  });
}

document.addEventListener('click',(e)=>{ const menu=document.getElementById('user-menu'); const btn=document.getElementById('user-btn'); if(!menu||!btn) return; if(btn.contains(e.target)) return; if(menu.contains(e.target)) return; closeUserMenu(); });

document.addEventListener('DOMContentLoaded',()=>{
  try{ window.scrollTo(0,0); }catch(e){}
  createCharts();
  let latestData = null;
  fetchData().then(d=>latestData = d);
  setInterval(async ()=>{ latestData = await fetchData(); },5000);
  $('export-csv').addEventListener('click',()=>exportCSV(latestData || {}));
  const pdfBtn = document.getElementById('export-pdf');
  const jpgBtn = document.getElementById('export-jpg');
  if(pdfBtn) pdfBtn.addEventListener('click', ()=>exportPDF(latestData || {}));
  if(jpgBtn) jpgBtn.addEventListener('click', ()=>exportJPG(latestData || {}));

  const userBtn = document.getElementById('user-btn');
  if(userBtn){ userBtn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleUserMenu(); }); }
  updateUserButton(); renderUserPanel();
});
