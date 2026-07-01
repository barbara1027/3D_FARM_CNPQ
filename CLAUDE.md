# CLAUDE.md — 3D Farm

Guia de referência para o assistente de IA trabalhar neste projeto.
Leia este arquivo antes de qualquer modificação de código.

---

## Visão geral

Sistema de gestão de uma farm de impressão 3D. Clientes fazem upload de arquivos STL, recebem orçamento automático gerado pelo PrusaSlicer CLI, pagam via Stripe e acompanham a impressão. Administradores gerenciam pedidos, materiais, qualidades e impressoras.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Express 5, TypeScript, MySQL2, JWT, Passport + Google OAuth, Multer, Swagger |
| Frontend | React 18, TypeScript, rolldown-vite 7.1.14, MUI v7, React Router v7, Axios |
| Banco | MySQL — banco: `3d_farm` |
| Slicer | PrusaSlicer CLI (processo externo via `child_process.spawn`) |
| Pagamento | Stripe — Checkout Session + Webhook implementados |

---

## Estrutura de pastas

```
3d-farm/
├── CLAUDE.md
├── backend/
│   ├── schema.sql                    ← schema base
│   ├── migration_pipeline.sql        ← colunas do pipeline (obrigatória)
│   ├── migration_nivel_usuario.sql   ← campo nivel na tabela usuarios
│   ├── migration_scheduler_columns.sql ← colunas de ETA/fila nos pedidos
│   ├── migration_temp_material_infill.sql
│   ├── migration_parametros_avancados.sql
│   ├── migration_arquivos_id_pedido.sql
│   ├── .env
│   ├── package.json
│   ├── uploads/                      ← STLs enviados pelos clientes
│   ├── gcode_storage/                ← G-codes gerados pelo slicer
│   └── src/
│       ├── server.ts                 ← entry point, porta 3333
│       ├── app.ts                    ← Express: CORS, session, passport, statics, Stripe webhook
│       ├── scheduler.ts              ← cron diário de reescalonamento da fila
│       ├── routes/index.ts           ← monta todos os routers
│       ├── database/connection.ts    ← pool MySQL2
│       ├── database/tables/          ← scripts de criação das tabelas (001–009)
│       ├── seed.ts                   ← popula banco com dados de teste
│       ├── middleware/auth.middleware.ts  ← authMiddleware + adminMiddleware
│       ├── services/
│       │   └── email.service.ts      ← nodemailer: revisão, falhou, concluído, impressora erro
│       ├── types/
│       │   ├── express.d.ts          ← augment Request com req.jwtUser
│       │   └── external.d.ts
│       ├── config/swagger.ts
│       └── modules/
│           ├── auth/                 ← login, JWT, Google OAuth
│           ├── usuarios/             ← CRUD + upsertGoogle
│           ├── materiais/            ← CRUD
│           ├── qualidadeImpressao/   ← CRUD (tabela: qualidades)
│           ├── arquivos/             ← upload STL/gcode com Multer
│           ├── pedidos/
│           │   ├── pedidos.repository.ts
│           │   ├── pedidos.service.ts
│           │   ├── pedidos.controller.ts
│           │   ├── pedidos.routes.ts      ← CRUD + chat + checkout + aprovar + reimprimir
│           │   ├── pagamentos.service.ts  ← cria Stripe Checkout Session
│           │   ├── stripe.controller.ts   ← webhook checkout.session.completed
│           │   └── etaEntrega.service.ts  ← estimativa de prazo de entrega
│           ├── fila/                 ← reescalonamento + otimização da fila
│           │   ├── fila.service.ts
│           │   ├── fila.controller.ts
│           │   ├── fila.routes.ts
│           │   └── filaOtimizacao.service.ts
│           ├── impressoras/          ← CRUD + adapters OctoPrint/Moonraker/DUMMY
│           │   └── comunicacao/
│           │       ├── orquestrador.service.ts
│           │       ├── octoprint.adapter.ts
│           │       ├── moonraker.adapter.ts
│           │       └── dummy.adapter.ts
│           └── slicer/
│               ├── auto-slice.service.ts   ← pipeline completo (orquestrador)
│               ├── slicer.service.ts       ← roda PrusaSlicer CLI
│               ├── gcode-parser.ts         ← extrai métricas do G-code
│               ├── complexity-scorer.ts    ← calcula score 0.0–1.0
│               └── price-calculator.ts     ← preço = tempo + material + complexidade + Stripe
└── frontend/
    ├── package.json
    └── src/
        ├── App.tsx                   ← rotas + guards RequireAuth/RequireAdmin
        ├── main.tsx                  ← BrowserRouter > ThemeProvider > AuthProvider
        ├── theme.ts
        ├── context/AuthContext.tsx   ← login/logout via window.location.href
        ├── services/api.ts           ← axios baseURL:3333, interceptors JWT + 401
        ├── types/
        │   ├── Pedido.ts
        │   ├── Material.ts
        │   ├── QualidadeImpressao.ts
        │   └── Impressora.ts
        ├── utils/
        │   ├── normalize.ts          ← converte strings MySQL → Number (completo)
        │   └── translations.ts       ← StatusPedido → label + cor MUI
        ├── components/
        │   ├── ClientLayout.tsx      ← AppBar com nav cliente + Outlet
        │   ├── AdminLayout.tsx       ← Drawer lateral admin + Outlet
        │   ├── NotificationsDrawer.tsx ← alertas de erros e fila (painel admin)
        │   ├── ConfigStep.tsx        ← ⚠️ ÓRFÃO — não importado por ninguém
        │   ├── ConfirmationStep.tsx  ← ⚠️ ÓRFÃO — não importado por ninguém
        │   └── UploadStep.tsx        ← ⚠️ ÓRFÃO — não importado por ninguém
        └── pages/
            ├── HomePage.tsx
            ├── LoginPage.tsx
            ├── RegisterPage.tsx          ← cadastro de novos usuários
            ├── AuthCallbackPage.tsx      ← captura ?token=&tipo= do Google OAuth
            ├── DashboardPage.tsx         ← pedidos do cliente (abas por status)
            ├── QuotesPage.tsx            ← orçamentos pré-pagamento + polling 5s
            ├── NewOrderPage.tsx          ← 3 passos: upload → config → confirmação
            └── admin/
                ├── AdminLoginPage.tsx
                ├── AdminDashboardPage.tsx
                ├── AdminOrdersPage.tsx
                ├── AdminQuotesPage.tsx   ← aba "Revisão" para peças complexas
                ├── AdminMaterialsPage.tsx
                ├── AdminQualidadesPage.tsx
                └── AdminPrintersPage.tsx
```

> **`components/ConfigStep.tsx`, `ConfirmationStep.tsx` e `UploadStep.tsx`** existem no projeto mas não são importados por nenhuma página. A `NewOrderPage.tsx` define seus próprios componentes inline. Podem ser deletados sem impacto.

---

## Comandos

```bash
# Backend
cd backend
npm install
npm run dev          # ts-node src/server.ts → porta 3333
npm run seed         # popula banco (requer usuários criados antes)
npm run typecheck    # tsc --noEmit
npm run build        # compila para dist/

# Frontend
cd frontend
npm install
npm run dev          # rolldown-vite → porta 5173
npm run build        # tsc -b && vite build
```

---

## Setup inicial do banco

```bash
# 1. Criar banco
mysql -u root -e "CREATE DATABASE IF NOT EXISTS 3d_farm;"

# 2. Schema base
mysql -u root 3d_farm < backend/schema.sql

# 3. Migrations — rodar em ordem
mysql -u root 3d_farm < backend/migration_pipeline.sql
mysql -u root 3d_farm < backend/migration_nivel_usuario.sql
mysql -u root 3d_farm < backend/migration_scheduler_columns.sql
mysql -u root 3d_farm < backend/migration_temp_material_infill.sql
mysql -u root 3d_farm < backend/migration_parametros_avancados.sql
mysql -u root 3d_farm < backend/migration_arquivos_id_pedido.sql

# 4. Tabelas auxiliares (se ainda não existirem)
mysql -u root 3d_farm < backend/src/database/tables/009_create_chat_mensagens.sql
```

### Criar usuários e rodar seed

O seed **não cria usuários** — requer pelo menos 1 admin e 1 cliente antes:

```bash
curl -X POST http://localhost:3333/usuarios \
  -H "Content-Type: application/json" \
  -d '{"nome":"Admin","email":"admin@3dfarm.com","senha":"admin123","tipo":"admin"}'

curl -X POST http://localhost:3333/usuarios \
  -H "Content-Type: application/json" \
  -d '{"nome":"Ana Clara","email":"ana@cliente.com","senha":"cliente123","tipo":"cliente"}'

cd backend && npm run seed
```

O seed cria: 5 materiais · 3 qualidades · 6 arquivos fictícios · 10 pedidos · 3 impressoras.

---

## Variáveis de ambiente (`backend/.env`)

Todas as variáveis obrigatórias já estão configuradas. Referência:

```env
PORT=3333

# Banco
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=3d_farm

# JWT e Sessão — já configurados com chaves aleatórias reais
JWT_SECRET=<chave real>
JWT_EXPIRES_IN=7d
SESSION_SECRET=<chave real>

# Upload
UPLOAD_DIR=uploads
GCODE_DIR=gcode_storage

# Google OAuth — já configurado corretamente
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
GOOGLE_CALLBACK_URL=http://localhost:3333/auth/google/callback
FRONTEND_URL=http://localhost:5173

# PrusaSlicer
PRUSA_SLICER_PATH=/Applications/PrusaSlicer.app/Contents/MacOS/PrusaSlicer
# Linux:   /usr/bin/prusa-slicer
# Windows: C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer-console.exe

# Precificação
BASE_HOURLY_RATE=8.00
TAXA_BASE_PEDIDO=2.00
STRIPE_FEE_PCT=0.0399
STRIPE_FEE_FIXED=0.39

# Email (nodemailer) — ⚠️ EMAIL_USER e EMAIL_PASS ainda vazios
ADMIN_EMAIL=admin@3dfarm.com
EMAIL_FROM=3D Farm <noreply@3dfarm.com>
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=          # ← preencher com conta Gmail
EMAIL_PASS=          # ← senha de app (myaccount.google.com/security)

# Stripe — já configurado com chaves de teste
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=http://localhost:5173/dashboard?pagamento=sucesso
STRIPE_CANCEL_URL=http://localhost:5173/quotes?pagamento=cancelado

# Scheduler (opcional)
CRON_REESCALONAMENTO=0 6 * * *   # padrão: todo dia às 6h
```

---

## Fluxo completo de um pedido

```
1. Cliente envia STL       POST /arquivos/upload
                           └─ Multer salva em uploads/, retorna { id, caminho }

2. Cliente cria pedido     POST /pedidos
                           { nome, idMaterial, idQualidade, idArquivo, parametros }
                           └─ status: analisando, preco: 0
                           └─ setImmediate → runAutoSlicePipeline(id) em background

3. Pipeline (background):
   a. Busca STL path + pricePerGram do material
   b. runPrusaSlicer(stl, params) → gcode_storage/pedido_N.gcode
   c. parseGcode(gcode)           → timeSeconds, materialGrams, supportRatio,
                                    retractionCount, islandCount, shortSegmentCount...
   d. scoreComplexity(metrics)    → score 0.0–1.0, isComplex, factors, summary
   e. calculatePrice(...)         → custoTempo, custoMaterial, taxaBase,
                                    taxaComplexidade, subtotal, taxaStripe, total
   f. UPDATE pedidos:
      score < 0.5  → status: aguardando_pagamento
                     emailRevisaoPendente() para o admin
      score ≥ 0.5  → status: aguardando_revisao
      erro         → status: falhou
                     emailPedidoFalhou() para o admin

4. Frontend faz polling a cada 5s (QuotesPage) até status != "analisando"

5. [Se complexo] Admin aprova   POST /pedidos/:id/aprovar { preco?: number }
                                └─ aguardando_revisao → aguardando_pagamento
                                └─ pode ajustar preço no body

6. Cliente paga               POST /pedidos/:id/checkout
                                └─ cria Stripe Checkout Session
                                └─ retorna { checkoutUrl }
                                └─ frontend redireciona para Stripe

7. Stripe confirma             POST /stripe/webhook
                                └─ evento checkout.session.completed
                                └─ verifica assinatura com STRIPE_WEBHOOK_SECRET
                                └─ status: na_fila

8. Admin atribui               POST /impressoras/:id/atribuir-pedido
                                └─ status: em_impressao
                                └─ orquestrador.startPrint() com o G-code

9. Conclusão                    PUT /pedidos/:id { status: "concluido" }
                                └─ emailClientePecaPronta() para o cliente
```

---

## Autenticação

### Email/senha
- `POST /auth/login` → bcrypt → JWT `{ sub, email, tipo }` → retorna `{ token, tipo, usuario }`
- Frontend: `localStorage.setItem('access_token', token)` e `localStorage.setItem('user_type', tipo)`
- `api.ts`: interceptor injeta `Authorization: Bearer <token>` em todas as requisições
- `api.ts`: interceptor de resposta redireciona para `/login` em caso de 401

### Google OAuth
- `GET /auth/google` → Passport → Google → `GET /auth/google/callback`
- Callback gera JWT e redireciona para `FRONTEND_URL/auth/callback?token=JWT&tipo=...`
- `AuthCallbackPage.tsx` captura os params e chama `login(token, tipo)`

### Guards (App.tsx)
Lêem `localStorage` diretamente — **nunca via estado React** para evitar race condition no primeiro render.

### AuthContext — regra crítica
`login()` e `logout()` usam **`window.location.href`**, não `navigate()`. Garante reload completo com token já persistido no `localStorage`.

---

## Chat admin↔cliente

O backend implementa um sistema de mensagens por pedido. **Não existe frontend ainda.**

```
GET  /pedidos/mensagens/conversas      ← lista conversas com preview (admin vê todas, cliente vê as suas)
GET  /pedidos/mensagens/resumo         ← total de não lidas por pedido
GET  /pedidos/:id/mensagens            ← histórico + marca do outro lado como lido
GET  /pedidos/:id/mensagens/nao-lidas  ← contagem sem marcar lido
POST /pedidos/:id/mensagens            ← envia mensagem { mensagem: string }
```

Tabela: `chat_mensagens` com campos `id_pedido`, `id_remetente`, `tipo_remetente` (admin|cliente), `mensagem`, `lido`.

---

## Fila de impressão

Módulo desenvolvido por João (branch `fila-impressao-limpa`, commit `e1184da`).

- `FilaService.reescalonarFilaVirtual()` — redistribui pedidos `na_fila` entre impressoras disponíveis
- `FilaOtimizacaoService` — otimização avançada com ETA, buffer de segurança, prioridade
- `EtaEntregaService` — calcula prazo estimado de entrega
- `scheduler.ts` — cron diário às 6h (configurável por `CRON_REESCALONAMENTO`)
- `POST /fila/reescalonar` — endpoint para acionar reescalonamento manualmente (admin)

**Não existe frontend para gerenciamento da fila.**

---

## Score de complexidade (`complexity-scorer.ts`)

Score 0.0–1.0. Limiar: **score ≥ 0.5 = complexo**.

| Fator | Peso máx | Dispara em | Satura em |
|---|---|---|---|
| Suporte | 0.25 | qualquer % | 30% |
| Ilhas geométricas | 0.20 | 20 ilhas | 200 ilhas |
| Retrações | 0.15 | 200 | 1000 |
| Segmentos curtos (<1mm) | 0.15 | 500 | 3000 |
| Duração longa | 0.15 | 2h | 18h |
| Perímetro externo | 0.10 | 25% | 60% |

Cada fator contribui linearmente entre os dois extremos. Total máximo = 1.0.

---

## Precificação (`price-calculator.ts`)

```
custoTempo       = (timeSeconds / 3600) × BASE_HOURLY_RATE
custoMaterial    = materialGrams × pricePerGram   (campo preco da tabela materiais)
taxaBase         = TAXA_BASE_PEDIDO               (fixo por pedido)
taxaComplexidade = (custoTempo + custoMaterial + taxaBase) × score × 0.60
subtotal         = custoTempo + custoMaterial + taxaBase + taxaComplexidade
taxaStripe       = (subtotal + STRIPE_FEE_FIXED) / (1 - STRIPE_FEE_PCT) - subtotal
total            = subtotal + taxaStripe
```

Todos os valores são persistidos no banco: `preco_base`, `taxa_complexidade`, `taxa_stripe`, `preco`.

---

## Impressoras

Campo `api` da impressora determina o adapter:

| Valor | Arquivo | Uso |
|---|---|---|
| `DUMMY` | `dummy.adapter.ts` | Simulação — use em desenvolvimento |
| `OCTOPRINT` | `octoprint.adapter.ts` | OctoPrint REST API |
| `MOONRAKER` | `moonraker.adapter.ts` | Klipper/Moonraker |

O `NotificationsDrawer` no painel admin mostra automaticamente impressoras com `status === 'Erro'` e pedidos com `status === 'na_fila'`.

---

## O que está implementado ✅

- Auth email/senha + Google OAuth completo
- Cadastro de novos usuários (RegisterPage)
- CRUD completo: usuários, materiais, qualidades, arquivos, pedidos, impressoras
- Upload STL com Multer
- Pipeline automático: criação → PrusaSlicer → parser → score → preço → update banco
- Score de complexidade 0–1 com 6 fatores ponderados
- Precificação com breakdown completo (tempo + material + complexidade + Stripe embutido)
- Aprovação de pedido complexo pelo admin com ajuste de preço opcional
- Download de G-code
- Stripe Checkout Session — `POST /pedidos/:id/checkout` → redireciona para Stripe
- Stripe Webhook — `POST /stripe/webhook` → confirma pagamento e move para `na_fila`
- Email notifications — revisão pendente, falhou, concluído, impressora com erro (nodemailer)
- Chat admin↔cliente — backend completo (listar, enviar, marcar lido, contagem)
- Fila de impressão — reescalonamento, otimização, ETA, scheduler diário
- `atribuir-pedido` — vincula pedido a impressora e inicia impressão
- Frontend cliente: NewOrderPage (3 passos), QuotesPage (polling + breakdown), DashboardPage
- Frontend admin: Dashboard com KPIs reais, aba Revisão, CRUD de todos os módulos, NotificationsDrawer
- Swagger UI em `/docs`

---

## O que falta implementar ❌

**1. Frontend do Chat**
O backend de chat está completo mas não existe nenhuma página ou componente no frontend. O cliente não consegue enviar mensagens ao admin, e o admin não consegue responder. Esta é a lacuna mais impactante para o usuário final.

**2. Frontend de Gestão da Fila (admin)**
A lógica de fila, otimização e scheduler do módulo `fila/` não tem interface. O admin não consegue ver a fila de pedidos aguardando impressão, reordenar prioridades nem acionar manualmente o reescalonamento pela UI.

**3. Email não configurado no `.env`**
`EMAIL_USER` e `EMAIL_PASS` estão vazios. O código de email está pronto e chamado nos lugares certos — só falta a conta Gmail com "senha de app" ativa.

---

## Bugs conhecidos ⚠️

**1. Três componentes órfãos em `components/`**
`ConfigStep.tsx`, `ConfirmationStep.tsx` e `UploadStep.tsx` não são importados por ninguém. Podem ser deletados.

---

## Padrões de código

### Backend — cadeia obrigatória
```
Repository → Service → Controller → Routes → routes/index.ts
```
- Lógica de negócio **sempre no service**, nunca no controller
- SQL **sempre com prepared statements**: `db.execute("WHERE id = ?", [id])`
- Banco usa `snake_case` → SELECT com aliases `camelCase`
- Service lança `throw new Error("mensagem.")` — controller faz try/catch e decide o status HTTP

### Frontend — regras críticas
- MySQL retorna `DECIMAL` como string — **sempre usar `normalize.ts`** antes de `.toFixed()`
- Guards de rota lêem `localStorage` diretamente — nunca via estado React
- `login()` e `logout()` usam `window.location.href` — nunca `navigate()`
- Novos status de pedido devem ser adicionados em **3 lugares simultaneamente**:
  1. `types/Pedido.ts` — tipo `StatusPedido`
  2. `utils/translations.ts` — label + cor MUI
  3. migration SQL — ENUM do MySQL

### Adicionando nova rota
1. Método no repository (SQL)
2. Método no service (lógica)
3. Método no controller (HTTP)
4. Registrar no `routes.ts` do módulo
5. Confirmar que o módulo está importado em `routes/index.ts`

---

## API — endpoints

```
# Auth
POST   /auth/login                          { email, senha } → { token, tipo, usuario }
GET    /auth/google                          inicia OAuth
GET    /auth/google/callback                 callback OAuth → redirect frontend
GET    /auth/me                              dados do usuário logado (auth)

# Pedidos
GET    /pedidos                             lista (admin=todos, cliente=seus)
POST   /pedidos                             cria + dispara pipeline automático
GET    /pedidos/:id
PUT    /pedidos/:id
DELETE /pedidos/:id                         (admin)
GET    /pedidos/:id/gcode                   download do G-code gerado
POST   /pedidos/:id/aprovar                 admin aprova revisão → aguardando_pagamento
POST   /pedidos/:id/checkout                cria Stripe Checkout Session → { checkoutUrl }
POST   /pedidos/:id/reimprimir              admin reenvia pedido para a fila (admin)

# Chat (backend pronto, sem frontend)
GET    /pedidos/mensagens/conversas         lista conversas com preview
GET    /pedidos/mensagens/resumo            não lidas por pedido
GET    /pedidos/:id/mensagens               histórico + marca como lido
GET    /pedidos/:id/mensagens/nao-lidas     contagem sem marcar lido
POST   /pedidos/:id/mensagens               envia mensagem { mensagem }

# Stripe
POST   /stripe/webhook                      evento checkout.session.completed

# Materiais
GET    /materiais
POST   /materiais                           (admin)
PUT    /materiais/:id                       (admin)
DELETE /materiais/:id                       (admin)

# Qualidades
GET    /qualidades
POST   /qualidades                          (admin)
PUT    /qualidades/:id                      (admin)
DELETE /qualidades/:id                      (admin)

# Arquivos
POST   /arquivos/upload                     campo multipart: "arquivo"
GET    /arquivos
GET    /arquivos/:id

# Impressoras
GET    /impressoras
POST   /impressoras                         (admin)
PUT    /impressoras/:id                     (admin)
DELETE /impressoras/:id                     (admin)
POST   /impressoras/:id/testar-conexao
POST   /impressoras/:id/sincronizar
POST   /impressoras/:id/liberar
POST   /impressoras/:id/atribuir-pedido     vincula pedido + inicia impressão (admin)

# Fila
POST   /fila/reescalonar                    aciona reescalonamento manual (admin)

# Usuários
GET    /usuarios                            (admin)
POST   /usuarios                            público — cadastro de novos usuários
PUT    /usuarios/:id
DELETE /usuarios/:id                        (admin)

# Utilitários
GET    /docs                                Swagger UI
GET    /docs.json                           OpenAPI spec
GET    /health                              { status: "ok" }
```
