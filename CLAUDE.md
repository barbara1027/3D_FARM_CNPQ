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
| Pagamento | Stripe — **ainda não implementado** |

---

## Estrutura de pastas

```
3d-farm/
├── CLAUDE.md
├── backend/
│   ├── migration_pipeline.sql        ← rodar ANTES de iniciar o backend
│   ├── .env
│   ├── package.json
│   ├── uploads/                      ← STLs enviados pelos clientes
│   ├── gcode_storage/                ← G-codes gerados pelo slicer
│   └── src/
│       ├── server.ts                 ← entry point, porta 3333
│       ├── app.ts                    ← Express: CORS, session, passport, statics
│       ├── routes/index.ts           ← monta todos os routers
│       ├── database/connection.ts    ← pool MySQL2
│       ├── seed.ts                   ← popula banco com dados de teste
│       ├── middleware/auth.middleware.ts  ← authMiddleware + adminMiddleware
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
│           ├── pedidos/              ← CRUD + /gcode + /aprovar
│           ├── impressoras/          ← CRUD + adapters OctoPrint/Moonraker/DUMMY
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
        │   ├── normalize.ts          ← converte strings MySQL → Number
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

# 2. Schema base (se existir)
mysql -u root 3d_farm < backend/schema.sql

# 3. Migration do pipeline — OBRIGATÓRIA
mysql -u root 3d_farm < backend/migration_pipeline.sql
```

A `migration_pipeline.sql` adiciona:
- ENUM `status` completo: `analisando`, `aguardando_pagamento`, `aguardando_revisao`, `na_fila`, `em_impressao`, `concluido`, `falhou`, `cancelado`
- Colunas: `parametros` (JSON), `gcode_path`, `tempo_estimado_s`, `material_gramas`, `score_complexidade`, `motivo_complexidade`, `preco_base`, `taxa_complexidade`, `taxa_stripe`

**Verificar se a migration foi aplicada:**
```sql
SHOW COLUMNS FROM pedidos LIKE 'score_complexidade';
-- Se não retornar nada → migration não foi aplicada ainda
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

> O seed insere pedidos com status antigos (`na_fila`, `em_impressao`, etc.) — não cobre `analisando`, `aguardando_pagamento` ou `aguardando_revisao`. Esses só aparecem em pedidos criados pelo fluxo real.

---

## Variáveis de ambiente (`backend/.env`)

```env
PORT=3333
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=3d_farm

# JWT — TROCAR em produção (ainda é o placeholder no projeto atual)
JWT_SECRET=troque_por_uma_chave_secreta_forte_aqui_minimo_32_chars
JWT_EXPIRES_IN=7d

# Session — FALTANDO no .env atual, adicionar
SESSION_SECRET=troque_aqui

# Upload
UPLOAD_DIR=uploads

# Google OAuth
# ⚠️ BUG: no .env atual está errado (porta 3000, rota /redirect)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3333/auth/google/callback   # correto
FRONTEND_URL=http://localhost:5173                                # faltando no .env atual

# PrusaSlicer CLI
PRUSA_SLICER_PATH=/Applications/PrusaSlicer.app/Contents/MacOS/PrusaSlicer
# Linux:   /usr/bin/prusa-slicer
# Windows: C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer-console.exe
GCODE_DIR=gcode_storage

# Precificação
BASE_HOURLY_RATE=15.00
TAXA_BASE_PEDIDO=5.00
STRIPE_FEE_PCT=0.0399
STRIPE_FEE_FIXED=0.39

# Stripe — ainda não implementado
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_SUCCESS_URL=http://localhost:5173/dashboard
STRIPE_CANCEL_URL=http://localhost:5173/quotes
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
      score ≥ 0.5  → status: aguardando_revisao
      erro         → status: falhou

4. Frontend faz polling a cada 5s (QuotesPage) até status != "analisando"

5. [Se complexo] Admin aprova   POST /pedidos/:id/aprovar { preco?: number }
                                └─ aguardando_revisao → aguardando_pagamento
                                └─ pode ajustar preço no body

6. [TODO] Cliente paga          POST /pedidos/:id/checkout   ← NÃO EXISTE AINDA
                                └─ criar Stripe Checkout Session
                                └─ retornar { checkoutUrl }

7. [TODO] Stripe confirma       POST /stripe/webhook          ← NÃO EXISTE AINDA
                                └─ evento checkout.session.completed
                                └─ status: na_fila

8. [TODO] Admin atribui         POST /impressoras/:id/atribuir-pedido ← NÃO EXISTE
                                └─ status: em_impressao

9. Conclusão                    PUT /pedidos/:id { status: "concluido" }
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
- CRUD completo: usuários, materiais, qualidades, arquivos, pedidos, impressoras
- Upload STL com Multer
- Pipeline automático: criação → PrusaSlicer → parser → score → preço → update banco
- Score de complexidade 0–1 com 6 fatores ponderados
- Precificação com breakdown completo (tempo + material + complexidade + Stripe embutido)
- Aprovação de pedido complexo pelo admin com ajuste de preço opcional
- Download de G-code
- Frontend cliente: NewOrderPage (3 passos), QuotesPage (polling + breakdown), DashboardPage
- Frontend admin: Dashboard com KPIs reais, aba Revisão, CRUD de todos os módulos, NotificationsDrawer
- Swagger UI em `/docs`

---

## O que falta implementar ❌

**1. `POST /pedidos/:id/checkout`** — Stripe Checkout Session
O botão "Pagar" na `QuotesPage` chama esta rota → 404 atualmente.
- Criar sessão Stripe com `line_items` baseado no pedido
- Salvar `stripe_session_id` no banco
- Retornar `{ checkoutUrl }`

**2. `POST /stripe/webhook`** — confirmação de pagamento
- Receber evento `checkout.session.completed`
- Verificar assinatura com `STRIPE_WEBHOOK_SECRET`
- Mudar status para `na_fila`
- ⚠️ Requer `express.raw()` **antes** do `express.json()` para esta rota específica

**3. `POST /impressoras/:id/atribuir-pedido`** — vincular pedido à impressora
- Associar pedido `na_fila` a uma impressora disponível
- Mudar status para `em_impressao`
- Chamar `orquestrador.startPrint()` com o G-code

---

## Bugs conhecidos ⚠️

**1. `GOOGLE_CALLBACK_URL` errado no `.env`**
Atual: `http://127.0.0.1:3000/auth/google/redirect`
Correto: `http://localhost:3333/auth/google/callback`
Google OAuth não funciona até corrigir.

**2. `FRONTEND_URL` ausente no `.env`**
Usado em `auth.routes.ts` no redirect pós-OAuth. Adicionar: `FRONTEND_URL=http://localhost:5173`

**3. `SESSION_SECRET` ausente no `.env`**
Adicionar: `SESSION_SECRET=qualquer_string_longa_aleatoria`

**4. `JWT_SECRET` ainda é o placeholder**
`JWT_SECRET=troque_por_uma_chave_secreta_forte_aqui_minimo_32_chars` — trocar por string aleatória real.

**5. `normalize.ts` incompleto — crash nas páginas admin**
`normalizePedido()` não converte os campos decimais do slicer. Correção:

```ts
export function normalizePedido(p: any) {
  return {
    ...p,
    preco:             Number(p.preco             ?? 0),
    idUsuario:         Number(p.idUsuario          ?? 0),
    idMaterial:        Number(p.idMaterial         ?? 0),
    idQualidade:       Number(p.idQualidade        ?? 0),
    idArquivo:         Number(p.idArquivo          ?? 0),
    // FALTANDO — adicionar:
    materialGramas:    p.materialGramas    != null ? Number(p.materialGramas)    : null,
    scoreComplexidade: p.scoreComplexidade != null ? Number(p.scoreComplexidade) : null,
    precoBase:         p.precoBase         != null ? Number(p.precoBase)         : null,
    taxaComplexidade:  p.taxaComplexidade  != null ? Number(p.taxaComplexidade)  : null,
    taxaStripe:        p.taxaStripe        != null ? Number(p.taxaStripe)        : null,
    tempoEstimadoS:    p.tempoEstimadoS    != null ? Number(p.tempoEstimadoS)    : null,
  };
}
```

**6. Três componentes órfãos em `components/`**
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
  3. `migration_pipeline.sql` — ENUM do MySQL

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
POST   /auth/login                     { email, senha } → { token, tipo, usuario }
GET    /auth/google                     inicia OAuth
GET    /auth/google/callback            callback OAuth → redirect frontend
GET    /auth/me                         dados do usuário logado (auth)

# Pedidos
GET    /pedidos                         lista (admin=todos, cliente=seus)
POST   /pedidos                         cria + dispara pipeline automático
GET    /pedidos/:id
PUT    /pedidos/:id
DELETE /pedidos/:id                     (admin)
GET    /pedidos/:id/gcode               download do G-code gerado
POST   /pedidos/:id/aprovar             admin aprova revisão → aguardando_pagamento
POST   /pedidos/:id/checkout            [TODO] Stripe Checkout Session

# Materiais
GET    /materiais
POST   /materiais                       (admin)
PUT    /materiais/:id                   (admin)
DELETE /materiais/:id                   (admin)

# Qualidades
GET    /qualidades
POST   /qualidades                      (admin)
PUT    /qualidades/:id                  (admin)
DELETE /qualidades/:id                  (admin)

# Arquivos
POST   /arquivos/upload                 campo multipart: "arquivo"
GET    /arquivos
GET    /arquivos/:id

# Impressoras
GET    /impressoras
POST   /impressoras                     (admin)
PUT    /impressoras/:id                 (admin)
DELETE /impressoras/:id                 (admin)
POST   /impressoras/:id/testar-conexao
POST   /impressoras/:id/sincronizar
POST   /impressoras/:id/liberar

# Usuários
GET    /usuarios                        (admin)
POST   /usuarios                        público — usado no setup inicial
PUT    /usuarios/:id
DELETE /usuarios/:id                    (admin)

# Utilitários
GET    /docs                            Swagger UI
GET    /docs.json                       OpenAPI spec
GET    /health                          { status: "ok" }
```