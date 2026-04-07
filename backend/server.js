require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
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

app.use(express.json());

// POST /api/notify - envia email usando nodemailer
app.post('/api/notify', upload.single('attachment'), async (req, res) => {
  // accepts both application/json (no file) and multipart/form-data (with file)
  const body = req.body || {};
  const { to, subject, message } = body;
  if(!to || !message){
    return res.status(400).json({ ok:false, error: 'Campos "to" e "message" são obrigatórios.' });
  }

  // configura transporte SMTP via variáveis de ambiente
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT,10) : undefined,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });

  const mailOptions = {
    from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@quadrodeforca.local',
    to,
    subject: subject || 'Relatório — Quadro de Força',
    text: typeof message === 'string' ? message : JSON.stringify(message, null, 2)
  };

  // se houver arquivo enviado via multipart (campo 'attachment'), anexa ao email
  if(req.file && req.file.buffer){
    mailOptions.attachments = [{ filename: req.file.originalname || 'relatorio.pdf', content: req.file.buffer }];
  }

  try{
    const info = await transporter.sendMail(mailOptions);
    return res.json({ ok:true, info });
  }catch(err){
    console.error('Erro enviando e-mail', err);
    return res.status(500).json({ ok:false, error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});
