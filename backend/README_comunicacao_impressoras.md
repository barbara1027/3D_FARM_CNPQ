# Remodelagem da comunicação com impressoras

## O que mudou

A comunicação com impressoras foi separada em uma camada própria dentro de `src/modules/impressoras/comunicacao`.

### Objetivos

- separar CRUD de impressoras da comunicação física
- evitar dupla alocação de impressora com reserva atômica
- salvar status físico, último erro e última sincronização
- registrar eventos de comunicação no MySQL
- suportar OctoPrint, Moonraker e DUMMY pelo mesmo contrato

## Fluxo novo

1. `POST /impressoras/:id/atribuir-pedido`
2. o service reserva a impressora se ela estiver `Ociosa`
3. busca o pedido e o arquivo G-code no banco
4. lê o G-code do disco de forma assíncrona
5. escolhe o adapter pelo protocolo
6. envia o arquivo e solicita início da impressão
7. salva `Imprimindo`, `job_remoto_id`, `status_fisico` e evento

## Rotas novas

- `POST /impressoras/:id/testar-conexao`
- `POST /impressoras/:id/sincronizar`
- `POST /impressoras/:id/atribuir-pedido`
- `POST /impressoras/:id/liberar`
- `GET /impressoras/:id/eventos`

## Estrutura

- `impressoras.repository.ts`: CRUD, reserva atômica e eventos
- `comunicacao/tipos.ts`: contratos da camada de comunicação
- `comunicacao/printer-adapter.factory.ts`: escolhe adapter por protocolo
- `comunicacao/octoprint.adapter.ts`: integração HTTP com OctoPrint
- `comunicacao/moonraker.adapter.ts`: integração HTTP com Moonraker
- `comunicacao/dummy.adapter.ts`: simulação local
- `comunicacao/orquestrador.service.ts`: orquestra pedido + arquivo + impressora

## Mudanças no banco

A tabela `impressoras` agora guarda também:

- `base_url`
- `timeout_ms`
- `status_fisico`
- `job_remoto_id`
- `ultimo_erro`
- `ultima_sincronizacao`

Também foi criada a tabela `impressora_eventos` para rastreabilidade.
