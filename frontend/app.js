// Configurações iniciais
const API_BASE = '/api'; // ajusta se seu backend usar outro prefixo
const pricePerKWh = 0.8; // valor de exemplo em moeda local — ajuste conforme necessário

let barChart, lineChart;

function $(id){return document.getElementById(id)}

function updateIndicators(data){
  $('total-watts').textContent = (data.totalWatts ?? 0) + ' W';
  $('daily-kwh').textContent = (data.dailyKwh ?? 0).toFixed(2) + ' kWh';
  $('cost').textContent = 'R$ ' + ((data.dailyKwh ?? 0) * pricePerKWh).toFixed(2);
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
  rows.push(['Nome','Watts']);
  (data.byDevice||[]).forEach(d=>rows.push([d.name,d.watts]));
  const csv = rows.map(r=>r.join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'consumo_por_aparelho.csv'; a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded',()=>{
  // garantir que a página abra no topo para evitar scroll automático
  try{ window.scrollTo(0,0); }catch(e){}
  createCharts();
  let latestData = null;
  fetchData().then(d=>latestData = d);
  setInterval(async ()=>{ latestData = await fetchData(); },5000);
  $('export-csv').addEventListener('click',()=>exportCSV(latestData || {}));
});
