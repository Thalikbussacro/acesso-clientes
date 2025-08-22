# Sistema de Gerenciamento de Acessos Remotos - Especificações do Projeto

## INSTRUÇÃO OBRIGATÓRIA

**Este documento contém as especificações técnicas do projeto. Consulte também:**
- `DEVELOPMENT_LOG.md` - Histórico detalhado de desenvolvimento
- `SETUP_GUIDE.md` - Comandos, troubleshooting e configurações

A IA deve:
1. Seguir rigorosamente as especificações deste documento
2. Consultar os arquivos complementares para contexto histórico e setup
3. Documentar progresso no DEVELOPMENT_LOG.md
4. Usar apenas as tecnologias especificadas

---

## CONTEXTO E OBJETIVO DO PROJETO

### Contexto Atual
Atualmente controlamos acessos remotos de 200+ clientes em um documento Word desorganizado:
- **À esquerda:** nome do cliente e forma de acesso (ex.: AnyDesk/Ndesk, LogMeIn, VPN)
- **À direita:** texto livre com cores/estilos, imagens e posicionamento manual
- **Problemas:** formato desorganizado, sem padrão, difícil manutenção e busca

### Objetivo
Criar uma **aplicação web para uso interno** que substitua o documento Word, permitindo:

1. **Gerenciamento organizado de clientes** e seus métodos de acesso (AnyDesk/Ndesk, LogMeIn, RDP, SSH, VPN, etc.)
2. **Campos dinâmicos configuráveis** - o administrador define quais campos cada método terá
3. **Notas em rich text** com formatação (negrito, listas, cores) e imagens com controle de posição
4. **Logs completos** de todos os acessos e alterações para auditoria
5. **Segurança máxima** com criptografia e duplo gate de proteção

### Requisitos de Segurança (CRÍTICOS)
1. **Criptografia Primordial:**
   - Todas as senhas e dados sensíveis sempre criptografados
   - Nunca texto puro no banco ou logs
   
2. **Duplo Gate de Segurança:**
   - **Gate 1:** Senha da base/workspace - necessária para acessar a aplicação
   - **Gate 2:** Mesma senha validada novamente ao acessar cada cliente individual
   - **IMPORTANTE:** É a mesma senha, mas deve ser solicitada duas vezes (abertura + acesso ao cliente)

3. **Ambiente 100% Local:**
   - Sem Docker, sem serviços externos
   - Banco de dados local (arquivo)
   - Execução via npm install e scripts

---

## ESPECIFICAÇÕES TÉCNICAS OBRIGATÓRIAS

### Stack Tecnológica (NÃO MUDAR)
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript + Better-SQLite3
- **Criptografia:** crypto (nativo) + bcrypt + jsonwebtoken
- **Rich Text:** TinyMCE ou Quill.js
- **Upload:** React-Dropzone + Multer
- **Desenvolvimento:** Concurrently + Nodemon + ESLint

### Requisitos Funcionais Detalhados

#### Gestão de Clientes
- **Listagem/pesquisa** de clientes com filtros
- **Tela do cliente** só libera dados após validação de senha
- **Notas em rich text** (negrito, listas, cores, etc.) com editor integrado
- **Imagens** com controle de posicionamento e alinhamento
- **CRUD completo** (criar, editar, excluir clientes)

#### Métodos de Acesso Dinâmicos
- **Cadastro de vários métodos** por cliente (AnyDesk/Ndesk, LogMeIn, RDP, SSH, VPN, "Outro")
- **Campos dinâmicos configuráveis** - administrador define nomes e tipos de campos
- **Tipos de campo suportados:** texto, senha, número, URL, etc.
- **Segredos sempre criptografados** no armazenamento
- **Ação de revelar/copiar** segredos com timeout visual
- **Validações por tipo** de campo

#### Logs e Auditoria Completa
- **Logs de acesso:** quem, quando, o quê (abrir cliente, revelar senha, etc.)
- **Logs de alterações:** before/after de qualquer modificação
- **Filtros avançados:** por cliente, ação, período
- **Exportação** em CSV/JSON
- **Performance** com muitos registros (paginação)

#### Fluxos Obrigatórios de Segurança
1. **Primeiro uso:** criar base de clientes e definir senha master
2. **Abertura do app:** solicitar senha da base para desbloquear
3. **Acesso a cliente:** solicitar mesma senha novamente (duplo gate)
4. **Revelar segredos:** apenas após duplo gate validado + log da ação
5. **Timeout de sessão:** re-autenticação após inatividade

### Especificações de Segurança Atualizadas
1. **Duplo Gate com Mesma Senha:**
   - **Gate 1:** Senha master para acessar a aplicação (unlock workspace)
   - **Gate 2:** Mesma senha master validada novamente para cada cliente
   - **Comportamento:** A mesma senha é solicitada em dois momentos diferentes
   
2. **Criptografia Primordial:**
   - Todas as senhas/dados sensíveis sempre criptografados (AES-256-GCM)
   - Nunca texto puro no banco ou logs
   - Chave de criptografia derivada da senha master
   
3. **Derivação de Chaves:**
   - PBKDF2 com 100k iterações para derivar chave master
   - Salt único por workspace para evitar rainbow tables
   - Recriptografia automática ao alterar senha master
   
4. **Logs Seguros:**
   - Todas as ações logadas (acesso, modificação, revelação)
   - Detalhes sensíveis criptografados nos logs
   - Campos não-sensíveis em texto claro para busca/filtros

### Estrutura do Projeto (OBRIGATÓRIA)
```
acesso-clientes/
├── package.json (scripts principais)
├── DESENVOLVIMENTO_IA.md (este arquivo)
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── services/
│   │   ├── routes/
│   │   └── server.ts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── main.tsx
│   └── package.json
└── data/
    ├── database.db
    └── uploads/
```

---

## FASES DE DESENVOLVIMENTO

### ✅ FASE 0: ESPECIFICAÇÃO COMPLETA
**Status:** ✅ CONCLUÍDA  
**Entregáveis:** Stack tecnológica, arquitetura, modelo de dados, API endpoints, fluxos de segurança, critérios de aceite.

### ✅ FASE 1: SETUP INICIAL E ESTRUTURA
**Status:** ✅ CONCLUÍDA  
**Estimativa:** 1-2 dias  
**Dependências:** Nenhuma  

**Tarefas:**
- Estrutura de pastas, package.json raiz, setup backend/frontend
- Configuração Vite + React + TypeScript + Tailwind CSS + ESLint
- Scripts de desenvolvimento (concurrently)

**Critérios de Aceite:**
- Estrutura idêntica ao especificado, ambos serviços iniciam sem erros
- Hot reload funcionando, TypeScript configurado, execução 100% local

### ✅ FASE 2: BACKEND CORE E SEGURANÇA
**Status:** ✅ CONCLUÍDA  
**Estimativa:** 3-4 dias  
**Dependências:** Fase 1  

**Tarefas:**
- Database Service (SQLite + migrations), Crypto Service (PBKDF2 + AES-256-GCM)
- Modelos de dados, middleware autenticação (duplo gate), controllers, audit service
- Rotas básicas de API, validação criptografia end-to-end

**Critérios de Aceite:**
- Banco SQLite correto, senhas nunca em texto puro, duplo gate funcionando
- Logs auditoria automáticos e criptografados, derivação chaves PBKDF2

### ✅ FASE 3: FRONTEND BASE E AUTENTICAÇÃO  
**Status:** ✅ CONCLUÍDA  
**Estimativa:** 2-3 dias  
**Dependências:** Fase 2  

**Tarefas:**
- Flow autenticação (unlock workspace), componentes login/unlock
- Roteamento protegido, lista clientes com busca, unlock individual
- Axios interceptors, gerenciamento estado, validação fluxo completo

**Critérios de Aceite:**
- Duplo gate funcionando, busca de clientes, sessões expirando
- Interface responsiva e user-friendly

### ✅ FASE 4: GESTÃO DE CLIENTES E RICH TEXT
**Status:** ✅ CONCLUÍDA  
**Estimativa:** 2-3 dias  
**Dependências:** Fase 3  

**Tarefas:**
- CRUD completo clientes, editor rich text (TinyMCE)
- Sistema criptografia de notas, interface gestão
- Busca e paginação, validação persistência rich text

**Critérios de Aceite:**
- Rich text funcionando, CRUD completo, notas criptografadas
- Editor TinyMCE integrado, performance adequada, interface responsiva

### 🔄 FASE 5: MÉTODOS DE ACESSO DINÂMICOS
**Status:** ⏳ PENDENTE  
**Estimativa:** 3-4 dias  
**Dependências:** Fase 4  

**Tarefas:**
- Sistema campos dinâmicos, interface configurar tipos método
- CRUD métodos de acesso, sistema revelar/copiar segredos
- Timeout visual para segredos, diferentes tipos de campo

**Critérios de Aceite:**
- Administrador define campos dinâmicos, segredos revelados temporariamente
- Cópia clipboard segura, validações por tipo de campo
- Logs revelações de segredos, interface intuitiva configuração

### 🔄 FASE 6: AUDITORIA E LOGS
**Status:** ⏳ PENDENTE  
**Estimativa:** 1-2 dias  
**Dependências:** Fase 5  

**Tarefas:**
- Visualizador de logs, filtros avançados (cliente, ação, período)
- Paginação logs, exportação CSV/JSON, dashboard estatísticas
- Limpeza automática logs antigos

**Critérios de Aceite:**
- Todas ações logadas, logs acesso/alterações completos
- Filtros avançados funcionam, export funcional
- Performance adequada, dados sensíveis criptografados, interface user-friendly

### 🔄 FASE 7: POLIMENTO E DEPLOY
**Status:** ⏳ PENDENTE  
**Estimativa:** 1-2 dias  
**Dependências:** Fase 6  

**Tarefas:**
- Otimizar performance (lazy loading, cache), atalhos teclado
- Responsividade mobile, scripts build/deploy
- Tratamento erros, testes carga 200+ clientes

**Critérios de Aceite Finais:**
- Suporta 200+ clientes sem lentidão, interface responsiva
- Execução local via npm, duplo gate funcionando
- Dados sensíveis criptografados, logs auditoria funcionais
- Rich text/imagens, campos dinâmicos, performance adequada

---

**IMPORTANTE:** Para informações detalhadas sobre desenvolvimento e setup, consulte:
- `DEVELOPMENT_LOG.md` - Histórico completo do desenvolvimento
- `SETUP_GUIDE.md` - Comandos, troubleshooting e configurações locais