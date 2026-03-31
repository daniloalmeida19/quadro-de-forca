const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

const consumo = {
  total_watts: 3620,
  hoje_kwh: 9.8,
  custo_local: 6.50,
  pico_watts: 4580,
  comodos: {
    cozinha: 850,
    sala: 420,
    quarto: 150,
    chuveiro: 2000,
    arCond: 600,
    maquinaLavar: 400
  }
};

app.get('/api/consumo', (req, res) => {
  res.json(consumo);
});

app.get('/', (req, res) => {
  res.send('Quadro de Força - Backend rodando');
});

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});
