# Remodelagem da comunicação com impressoras

## O que mudou

A comunicação com impressoras foi separada em uma camada própria dentro de `src/modules/impressoras/comunicacao`.

### Objetivos

- separar CRUD de impressoras da comunicação física
- usar `pedido_impressora` como única fila planejada e executável
- evitar dupla alocação de pedido ou impressora com reserva transacional
- revalidar material e slot imediatamente antes do envio
- salvar status físico, último erro e última sincronização
- registrar eventos de comunicação no MySQL
- suportar DUMMY, Moonraker e OctoPrint pelo mesmo contrato

## Fluxo novo

1. `FilaService` calcula impressora, posição e slot e persiste o plano em
   `pedido_impressora`.
2. O orquestrador consome a primeira alocação executável dessa tabela, sem
   aplicar outra ordenação por prioridade ou FIFO.
3. Uma transação com locks confirma pedido e impressora, grava
   `pedido_impressora.status = 'reservado'` e associa
   `impressoras.id_pedido_atual`.
4. Fora da transação, o orquestrador lê o G-code e revalida os slots atuais.
5. Sem o material correto, a alocação passa para `aguardando_filamento`, a
   impressora é liberada e nenhum arquivo é enviado.
6. Sem CFS, o adapter comum envia o arquivo e o estado físico é consultado até
   confirmar o início.
7. Com CFS, um adapter específico precisa resolver inventário, endereço físico
   e mapeamento lógico antes do envio. Não existe fallback para o início comum.
8. O estado físico é consultado até `Imprimindo`; quando o adapter fornece um
   identificador de job, uma divergência também bloqueia a confirmação.
9. Somente após confirmação física uma segunda transação altera pedido,
   alocação e impressora para `em_impressao`.

Uma rejeição comprovadamente anterior ao início libera a reserva e usa o
backoff persistente. Se o comando puder ter sido aceito, a alocação permanece
`reservado`, a impressora fica em `Erro` mantendo `id_pedido_atual`, e nenhum
worker pode reenviar o pedido. Uma sincronização posterior pode confirmar a
reserva somente se observar em `Imprimindo` o mesmo identificador remoto que
foi preservado no bloqueio. Sem identificador correlacionável, com outro job,
estado ocioso ou resultado inconclusivo, a reserva continua bloqueada para
inspeção e reconciliação administrativa. A liberação manual também é recusada
nesse estado, antes de qualquer tentativa de desligar aquecedores.

## Rotas novas

- `POST /impressoras/:id/testar-conexao`
- `POST /impressoras/:id/sincronizar`
- `POST /impressoras/:id/atribuir-pedido`
- `POST /impressoras/:id/liberar`
- `GET /impressoras/:id/eventos`

## Estrutura

- `fila/pedidoImpressora.repository.ts`: locks, reserva e transições atômicas da fila
- `impressoras.repository.ts`: CRUD, slots e eventos
- `comunicacao/tipos.ts`: contratos da camada de comunicação
- `comunicacao/printer-adapter.factory.ts`: escolhe adapter por protocolo
- `comunicacao/octoprint.adapter.ts`: integração HTTP com OctoPrint
- `comunicacao/moonraker.adapter.ts`: integração HTTP com Moonraker
- `comunicacao/dummy.adapter.ts`: simulação local
- `comunicacao/dummy-cfs-print.adapter.ts`: simulação do inventário e mapeamento CFS
- `comunicacao/creality-cfs-print.adapter.ts`: fronteira segura do protocolo proprietário
- `comunicacao/orquestrador.service.ts`: orquestra pedido + arquivo + impressora

## Estado da integração CFS da Creality

O repositório modela separadamente o `idMaterialBanco` interno e o endereço
físico (`boxId`/`deviceMaterialId`) relatado pelo CFS. O número do slot nunca é
transformado em `T0`–`T3` e o fluxo CFS não usa `/printer/gcode/script` para
selecionar material.

O código e a documentação oficiais do Creality Print comprovam a existência de
um mapeamento separado (`open_cfs`, `color_match_info`, `send_print_cmd`), mas
não comprovam sozinhos o contrato LAN final de cada firmware. Por isso, o
adapter físico permanece bloqueado com `CFS_MAPPING_UNSUPPORTED`. Para
habilitá-lo ainda são necessárias capturas sanitizadas do mesmo G-code enviado
pelos slots 1 e 2, incluindo endpoint, porta, autenticação, inventário, payload,
resposta e validação física separada na K2 Pro e na Creality Hi.

Referências arquiteturais oficiais inspecionadas:

- [filament_mapping.md](https://github.com/CrealityOfficial/CrealityPrint/blob/master/doc/simple-mode/filament_mapping.md)
- [SendToPrinter.cpp](https://github.com/CrealityOfficial/CrealityPrint/blob/master/src/slic3r/GUI/print_manage/App/SendToPrinter.cpp)

Elas sustentam a separação lógico→físico e os nomes conceituais acima; não são
tratadas como captura de uma impressora nem como confirmação de endpoint,
autenticação, resposta de sucesso ou comportamento físico.

O `DummyCfsPrintAdapter` permite testar o fluxo sem I/O real. Ele exige um
índice lógico `Tn` explicitamente presente no G-code, inventário físico e IDs de
dispositivo distintos de `materiais.id`.

O parser aceita `Tn` somente como comando de ferramenta do bloco G-code (com
`N...` opcional), e não como texto de `M117`/`M118` ou parâmetro de outro
comando. Ainda falta gerar e inspecionar um G-code real do pipeline para saber
qual índice lógico o perfil de produção emite; nunca se presume `T0`.

## Mudanças no banco

As definições oficiais ficam em `src/database/tables/006_create_impressoras.sql`, `src/database/tables/007_create_impressora_slots_filamento.sql` e `src/database/tables/008_create_impressora_eventos.sql`. Elas são aplicadas somente por `npm run db:init`, conforme a [configuração canônica do banco](docs/database-setup.md).

A tabela `impressoras` agora guarda também:

- `base_url`
- `timeout_ms`
- `status_fisico`
- `job_remoto_id`
- `ultimo_erro`
- `ultima_sincronizacao`

Também foi criada a tabela `impressora_eventos` para rastreabilidade.

O valor seguro e padrão de `impressoras.api` é `DUMMY`, inclusive para os dados de demonstração. As impressoras reais do projeto usam `MOONRAKER`. `OCTOPRINT` permanece disponível por compatibilidade, mas não deve ser adotado como padrão.
