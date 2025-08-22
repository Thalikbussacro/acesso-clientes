# Sistema de Gerenciamento de Acessos Remotos - Guia de Setup

## Início Rápido

### Como Iniciar o Sistema
```bash
# No diretório raiz do projeto
npm run dev

# Ou manualmente em terminais separados:
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend  
cd frontend && npm run dev
```

### URLs do Sistema
- **Frontend:** http://localhost:5173 (ou 5174)
- **Backend:** http://localhost:3002
- **Health Check:** http://localhost:3002/api/health

## Configuração Inicial

### Primeira Instalação
```bash
# Instalar todas as dependências
npm run install:all

# Validar que tudo funciona
npm run dev
```

### Estrutura de Arquivos Importantes
```
acesso-clientes/
├── data/
│   └── database_new.db           # Database SQLite atual
├── backend/
│   ├── src/services/
│   │   ├── DatabaseService.ts    # Configuração do banco (linha 15)
│   │   └── CryptoService.ts      # Serviços de criptografia
│   └── src/middleware/auth.ts    # Autenticação duplo gate
└── frontend/
    ├── src/services/api.ts       # Configuração axios (linhas 1-10)
    └── src/contexts/AuthContext.tsx  # Context de autenticação
```

## Configuração Local Sensível

### Credenciais de Desenvolvimento
- **Senha Master:** `@Mrpolado36`
- **Workspace:** "SoAutomacao"
- **Database Path:** `data/database_new.db`

### Configurações de Porta
- **Backend:** Porta 3002 (evita conflitos)
- **Frontend:** Porta 5173/5174 (Vite escolhe automaticamente)
- **CORS:** Backend configurado para aceitar frontend

## Comandos de Desenvolvimento

### Scripts Disponíveis
```bash
# Desenvolvimento
npm run dev              # Inicia ambos os serviços
npm run build           # Build de produção
npm run install:all     # Instala dependências

# Backend específico
cd backend
npm run dev             # Desenvolvimento com nodemon
npm run build           # Transpila TypeScript
npm start               # Produção

# Frontend específico  
cd frontend
npm run dev             # Vite dev server
npm run build           # Build otimizado
npm run preview         # Preview do build
```

### Validação do Sistema
```bash
# 1. Verificar se serviços estão rodando
curl http://localhost:3002/api/auth/status

# 2. Verificar database
ls -la data/database_new.db

# 3. Verificar frontend
# Acessar http://localhost:5173 no browser
```

## Troubleshooting

### Problemas Comuns

#### Portas Ocupadas
```bash
# Liberar portas específicas
npx kill-port 3002      # Backend
npx kill-port 5173      # Frontend

# PowerShell: finalizar todos os processos Node
Get-Process node | Stop-Process -Force

# Verificar processos na porta
netstat -ano | findstr :3002
```

#### Processo Node Travado
```powershell
# PowerShell - Finalizar processos
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Bash/Linux/MacOS
pkill -f node
```

#### Database Locked
```bash
# Parar backend, aguardar 2 segundos, reiniciar
# Ou remover database para reset completo
rm data/database_new.db  # Linux/MacOS
# PowerShell:
Remove-Item 'data/database_new.db' -Force
```

#### Gate 2 Não Funciona
1. Verificar se workspace está desbloqueado primeiro
2. Confirmar que mesma senha está sendo usada
3. Verificar logs de auditoria no banco

#### TinyMCE Não Carrega
1. Verificar configuração do Vite em `frontend/vite.config.ts`
2. Confirmar imports em `frontend/src/hooks/useTinyMCE.ts`
3. Verificar console do browser para erros

#### Erros TypeScript
1. Verificar imports com `type` para interfaces
2. Confirmar que dependências estão instaladas
3. Limpar cache: `rm -rf node_modules && npm install`

### Reset Completo do Sistema
```powershell
# PowerShell - Reset total
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
npx kill-port 3001
npx kill-port 3002  
npx kill-port 5173
npx kill-port 5174
Remove-Item 'data/database_new.db' -Force -ErrorAction SilentlyContinue

# Depois executar
npm run dev
```

### Verificação de Status
```bash
# Verificar conexão de rede
Test-NetConnection localhost -Port 3002  # Backend
Test-NetConnection localhost -Port 5173  # Frontend

# Verificar processos Node ativos
Get-Process node

# Verificar logs em tempo real
# Terminal 1: Backend logs
cd backend && npm run dev

# Terminal 2: Frontend logs  
cd frontend && npm run dev
```

## Testing

### Teste Manual do Fluxo Completo
1. **Acesso inicial:** http://localhost:5173 → redireciona para setup ou login
2. **Login:** usar senha `@Mrpolado36`
3. **Unlock workspace (Gate 1):** usar mesma senha
4. **Acesso cliente (Gate 2):** clicar "Acessar" → usar mesma senha
5. **CRUD clientes:** criar, editar, buscar, excluir
6. **Rich text:** testar editor TinyMCE

### Testes de API via cURL
```bash
# 1. Verificar status
curl -X GET http://localhost:3002/api/auth/status

# 2. Login
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"@Mrpolado36"}'

# 3. Unlock (usar token do passo 2)
curl -X POST http://localhost:3002/api/auth/unlock \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [TOKEN]" \
  -d '{"password":"@Mrpolado36"}'

# 4. Criar cliente
curl -X POST http://localhost:3002/api/clients \
  -H "Authorization: Bearer [TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Client","notes":"<p><strong>Rich text</strong></p>"}'
```

### Verificação de Segurança
```bash
# Verificar criptografia no banco
sqlite3 data/database_new.db "SELECT * FROM workspaces;"
sqlite3 data/database_new.db "SELECT id, name, notes_content IS NOT NULL as has_notes FROM clients;"
sqlite3 data/database_new.db "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5;"

# ❗ IMPORTANTE: Senhas NÃO devem aparecer em texto puro
# ⚠️  ATENÇÃO: A criptografia atual usa XOR+Base64 (temporária)
#              Verificar arquivo CryptoService.ts linha 57-89
```

## Ambiente de Desenvolvimento

### Dependências Críticas
- **Node.js:** Versão 16+ recomendada
- **npm:** Versão 8+ recomendada  
- **SQLite3:** Incluído nas dependências
- **TypeScript:** Configurado globalmente

### Configurações do Editor
- **ESLint:** Configurado para backend e frontend
- **TypeScript:** Strict mode habilitado
- **Prettier:** Integrado com ESLint

### Performance
- **Hot reload:** Funciona em ambos os serviços
- **Build time:** ~30s para build completo
- **Startup time:** ~5s para ambos os serviços