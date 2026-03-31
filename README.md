Quadro de Força — Monitoramento de Consumo

Descrição
- Dashboard simples para monitorar consumo elétrico por cômodo e por aparelho.

Como rodar (local)
1. Backend
   - Abra um terminal na pasta `backend`:
     ```powershell
     cd backend
     npm.cmd install
     $env:PORT=3001
     npm.cmd start
     ```
   - O backend ficará disponível em `http://localhost:3001` e expõe a rota `/api/consumo`.

2. Frontend
   - Abra `frontend/index.html` diretamente no navegador ou sirva a pasta `frontend`:
     ```powershell
     cd frontend
     # opcional: instalar http-server
     npm.cmd install -g http-server
     http-server -p 8080
     # abrir http://localhost:8080
     ```

Notas
- As configurações de porta podem ser alteradas via variável de ambiente `PORT` no backend.
- O frontend busca dados em `API_BASE` dentro de `frontend/app.js` (por padrão `'/api'`). Se servir o frontend por HTTP separado, ajuste `API_BASE` para `http://localhost:3001/api`.

Próximos passos sugeridos
- Produzir endpoints adicionais (histórico, alertas) e persistência em banco.
- Implementar autenticação e exportação em PDF.
