# Teste ponta a ponta real via Moonraker (sem CFS)

Este roteiro comprova o fluxo completo `pedido → fila → impressora física`
usando uma impressora real com Moonraker, imprimindo de verdade. Ele é
separado do procedimento oficial do banco (`docs/database-setup.md`) e deve
ser executado no servidor que já roda o backend na mesma rede das
impressoras.

## Correções aplicadas antes deste roteiro

Uma revisão do caminho crítico (upload → slicing → fila → Moonraker →
monitor) encontrou seis problemas que quebrariam ou distorceriam este teste
físico. Já foram corrigidos no código-fonte:

1. **Timeout de confirmação de início consumido por uma única chamada
   lenta** — `confirmarInicioFisico` (`orquestrador.service.ts`) agora limita
   cada chamada de status a no máximo 5s, independente do `timeoutMs`
   configurado da impressora, garantindo várias tentativas dentro do
   orçamento total (`PRINTER_START_CONFIRM_TIMEOUT_MS`).
2. **PrusaSlicer sem `--bed-shape`** — `slicer.service.ts` agora passa a mesa
   real (`--bed-shape`) junto com `--center`, usando as dimensões cadastradas
   da impressora. Antes disso, peças válidas podiam ser recusadas como "fora
   da área de impressão" na mesa padrão embutida do CLI.
3. **Suporte sempre forçado, ignorando a qualidade escolhida** —
   `auto-slice.service.ts` agora respeita `qualidades.suporte`; sem esse
   ajuste, toda peça saía com suporte tocando a mesa mesmo quando a
   qualidade não pedia isso.
4. **`testar-conexao` sempre retornava `ok: true`** — `MoonrakerAdapter.healthCheck`
   agora só retorna `ok: true` quando `webhooks.state === "ready"`.
5. **Falha de rede engolida antes do upload** — o probe de Klippy em
   `uploadAndStart` agora distingue "sem resposta nenhuma" (impressora
   inalcançável — falha rápido com erro claro) de "resposta HTTP inesperada"
   (degrada e segue, como antes).
6. **Download de arquivo rejeitando o próprio dono** — a guarda de path
   traversal de `GET /arquivos/:id/download` agora valida contra
   `UPLOAD_DIR`/`GCODE_DIR` reais, não contra `process.cwd()`.

Se este roteiro for executado numa cópia do backend anterior a essas
correções, atualize o código antes de prosseguir.

## Por que sem CFS

A K2 Pro e a Creality Hi do projeto têm `possui_cfs = 1`. Nesse modo, o
orquestrador delega o envio ao `CrealityCfsPrintAdapter`
(`src/modules/impressoras/comunicacao/creality-cfs-print.adapter.ts`), que
**sempre** lança `CFS_MAPPING_UNSUPPORTED` — o protocolo LAN proprietário da
torre AMS da Creality ainda não foi validado (faltam capturas sanitizadas do
mesmo G-code enviado pelos slots 1 e 2, endpoint, autenticação e validação
separada em cada firmware; ver
`README_comunicacao_impressoras.md`, seção "Estado da integração CFS").
Nenhuma requisição de rede é feita nesse caminho — é uma recusa deliberada, não
uma falha de configuração.

Para testar o transporte real (slicing → G-code real → upload real via
Moonraker → impressão física → conclusão detectada automaticamente), a
impressora precisa estar cadastrada com **`possuiCfs = false`** neste teste.
Isso pula inteiramente o adapter CFS e usa o caminho comum
(`orquestrador.service.ts`, branch `else` de `iniciarReserva`), que é o mesmo
código de produção para impressoras sem torre. A única perda é a seleção
automática de material por slot: com `possuiCfs = false`,
`localizarSlotElegivel` só considera o slot 1
(`orquestrador.service.ts:703-707`), então o filamento correto precisa estar
fisicamente carregado no extrusor ativo antes do envio — como numa impressora
sem AMS.

Se quiser testar com a torre AMS ativa de verdade, é um projeto à parte:
captura de tráfego LAN do Creality Print controlando a impressora,
documentação do protocolo e implementação do adapter físico. Não faça isso
adivinhando o payload contra o hardware real — um mapeamento de slot errado
imprime com o material errado.

## Pré-requisitos no servidor

- Node.js, `npm install` já rodado em `backend/` e `frontend/` (opcional para
  este teste, que pode ser feito só via API/Swagger).
- MySQL 8.0.16+ com o banco inicializado (`npm run db:init` +
  `npm run db:verify`, ver `docs/database-setup.md`).
- PrusaSlicer instalado e `PRUSA_SLICER_PATH` no `.env` apontando para o
  binário real (`prusa-slicer-console.exe` no Windows,
  `/usr/bin/prusa-slicer` no Linux). Sem isso todo pedido termina em
  `falhou` no pipeline.
- `.env` completo (ver `.env.example`). **Correção**: `server.ts` só recusa
  subir sem `DB_HOST, DB_USER, DB_NAME, JWT_SECRET, SESSION_SECRET`
  (`REQUIRED_ENV`, `server.ts:5`) — `UPLOAD_DIR` e `GCODE_DIR` **não** estão
  nessa lista e caem silenciosamente para `uploads`/`gcode_storage`
  relativos a `process.cwd()` se ausentes (`arquivos.controller.ts:7`,
  `slicer.service.ts:46`). Defina os dois explicitamente mesmo assim: se o
  backend rodar como serviço (systemd/pm2/serviço do Windows) com working
  directory diferente do usado nos testes manuais, o upload do STL ou a
  leitura do G-code na hora de imprimir falha com `ENOENT` sem aviso prévio.
  Confirme também que `JWT_SECRET` está de fato definido — se ausente, o
  backend sobe normalmente (não é bloqueado por isso) mas assina/valida
  tokens com o valor padrão `dev_secret_troque_em_producao`
  (`auth.middleware.ts:21`, `auth.service.ts:6`), o que aceitaria qualquer
  token forjado com essa mesma string.
- A impressora real acessível pela rede do servidor, com Moonraker na porta
  **7125** (não a 80, que é o nginx do Mainsail/Fluidd e bloqueia o upload).
- Um usuário admin no banco. Se `db:seed` foi usado, use
  `admin.dev@3dfarm.invalid` com `DEV_SEED_PASSWORD`; senão crie um via
  `POST /usuarios` e ajuste `tipo = 'admin'` diretamente no banco.

## 1. Login admin

```bash
curl -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin.dev@3dfarm.invalid","senha":"<DEV_SEED_PASSWORD>"}'
```

Guarde o `token` da resposta — todas as chamadas abaixo usam
`Authorization: Bearer <token>`.

## 2. Cadastrar a impressora real (sem CFS, só para este teste)

```bash
curl -X POST http://localhost:3333/impressoras \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "K2 Pro (teste real sem CFS)",
    "modelo": "K2 Pro",
    "status": "Ociosa",
    "baseUrl": "http://<IP_DA_IMPRESSORA>:7125",
    "api": "MOONRAKER",
    "api_key": "<API_KEY_SE_HOUVER>",
    "timeoutMs": 5000,
    "possuiCfs": false,
    "larguraMesaMm": 300,
    "profundidadeMesaMm": 300,
    "capacidadeDiaHoras": 8
  }'
```

- `baseUrl` deve terminar em `:7125`. Confirme antes com
  `curl http://<IP>:7125/printer/info` a partir do próprio servidor.
- Ajuste `larguraMesaMm`/`profundidadeMesaMm` para a mesa real — o pipeline
  usa o **maior** valor entre todas as impressoras cadastradas para centrar o
  G-code (`auto-slice.service.ts`, `maiorCentroDeMesaConhecido`), então, se
  houver impressoras DUMMY do seed com mesa maior no mesmo banco, remova-as
  ou desative-as antes do teste para não deslocar o G-code.
- Guarde o `id` retornado (`<IMPRESSORA_ID>`).

## 3. Carregar o filamento real no slot 1

Cadastre o material que está fisicamente no bico (crie via
`POST /materiais` se ainda não existir) e associe ao slot 1:

```bash
curl -X PUT http://localhost:3333/impressoras/<IMPRESSORA_ID>/slots/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"idMaterial": <ID_DO_MATERIAL>}'
```

## 4. Testar a conexão

```bash
curl -X POST http://localhost:3333/impressoras/<IMPRESSORA_ID>/testar-conexao \
  -H "Authorization: Bearer <token>"
```

Resposta esperada: `ok: true` (agora só é `true` quando `webhooks.state`
realmente for `"ready"` — ver correção 4 acima). Se vier `ok: false`, o corpo
traz `webhooks`/`print_stats` para diagnóstico; resolva o erro no Klipper
antes de continuar.

## 5. Upload do STL

```bash
curl -X POST http://localhost:3333/arquivos/upload \
  -H "Authorization: Bearer <token>" \
  -F "arquivo=@/caminho/para/peca.stl"
```

Guarde o `id` retornado (`<ARQUIVO_ID>`).

## 6. Criar o pedido como admin

Pedidos criados por um usuário `tipo = admin` pulam pagamento e revisão e vão
direto para `na_fila` assim que o slicing terminar
(`resolverStatusAposAnalise`, `auto-slice.service.ts`) — é o caminho mais
curto para o teste físico. Use `idQualidade` de uma qualidade já cadastrada.

```bash
curl -X POST http://localhost:3333/pedidos \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Teste E2E Moonraker",
    "idMaterial": <ID_DO_MATERIAL>,
    "idQualidade": <ID_DA_QUALIDADE>,
    "idArquivo": <ARQUIVO_ID>,
    "quantidade": 1
  }'
```

O pedido volta com `status: "analisando"`. O pipeline roda em background
(PrusaSlicer real → parser de G-code → score → preço → ETA).

## 7. Acompanhar o slicing

```bash
curl http://localhost:3333/pedidos/<PEDIDO_ID> \
  -H "Authorization: Bearer <token>"
```

Repita até `status` sair de `analisando`. Se cair em `falhou`, o erro está nos
logs do servidor (`[AUTO-SLICE] ERRO ...`) — normalmente `PRUSA_SLICER_PATH`
errado (a causa "peça fora da mesa" ficou menos provável depois da correção 2
acima, que passou a informar a mesa real ao PrusaSlicer). Se tudo certo, o
status vai direto para `na_fila` (por ser pedido de admin).

## 8. Disparar o planejamento da fila

O reescalonamento roda sozinho no cron diário, mas para o teste dispare na
hora:

```bash
curl -X POST http://localhost:3333/fila/reescalonar \
  -H "Authorization: Bearer <token>"
```

Isso calcula a alocação em `pedido_impressora` para o pedido criado.

## 9. Atribuir e imprimir

A varredura periódica do `scheduler.ts` tenta atribuir sozinha a cada 30s.
Para não esperar, dispare direto:

```bash
curl -X POST http://localhost:3333/impressoras/<IMPRESSORA_ID>/atribuir-pedido \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"idPedido": <PEDIDO_ID>}'
```

Isso executa de verdade: `healthCheck` → checa `Klippy ready` → upload do
G-code por `POST /server/files/upload` → `POST /printer/print/start` →
polling de status até `print_stats.state = "printing"` (orçamento total
`PRINTER_START_CONFIRM_TIMEOUT_MS`, padrão 15s, agora dividido em várias
chamadas de até 5s cada — correção 1 acima). Se a impressora aceitar, a
resposta HTTP confirma o início e a impressão física começa nesse
momento — acompanhe fisicamente a partir daqui.

## 10. Acompanhar e concluir

- O `PrinterMonitorWorker` consulta a impressora a cada 20s
  (`PRINTER_MONITOR_INTERVALO_MS`) somente para impressoras `MOONRAKER` em
  `Imprimindo`. Quando o Klipper reportar `complete`/`standby`, o pedido é
  marcado `concluido` automaticamente e a impressora passa para
  `Aguardando Remoção`.
- Progresso em tempo real: `GET /impressoras/<IMPRESSORA_ID>/progresso`.
- Depois de retirar a peça fisicamente:

```bash
curl -X POST http://localhost:3333/impressoras/<IMPRESSORA_ID>/confirmar-remocao \
  -H "Authorization: Bearer <token>"
```

Isso libera a impressora de volta para `Ociosa`.

## Depois do teste

A impressora cadastrada aqui é só para validação — ela não tem a torre AMS
ativa. Antes de usá-la em produção, apague este cadastro de teste (ou
restaure `possuiCfs = true`) para não conflitar com o cadastro real de CFS
que a farm usa no dia a dia.
