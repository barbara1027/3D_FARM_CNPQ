# Testes manuais da fila de impressao

## Cenario 1: prioridade nao pode quebrar prazo de pedido normal

1. Cadastre uma impressora disponivel com capacidade diaria suficiente para dois pedidos curtos.
2. Crie um pedido normal antigo com `tempo_maximo_espera_horas` baixo, proximo de zero.
3. Crie um pedido prioritario mais novo.
4. Chame `POST /fila/reescalonar`.
5. Verifique que o prioritario nao ultrapassou o pedido normal se a troca faria o normal iniciar depois de `tempo_maximo_espera_horas` ou concluir depois de `prazo_entrega`.

## Cenario 2: prioridade pode ultrapassar quando ha folga

1. Cadastre uma impressora disponivel com capacidade diaria suficiente para dois pedidos curtos.
2. Crie um pedido normal antigo com bastante folga em `tempo_maximo_espera_horas` e `prazo_entrega`.
3. Crie um pedido prioritario mais novo.
4. Chame `POST /fila/reescalonar`.
5. Verifique que o prioritario pode aparecer antes do normal na sequencia planejada se a simulacao mantiver o normal dentro dos limites.

## Cenario 3: ETA cresce com workload pendente

1. Cadastre pelo menos uma impressora disponivel com `eficiencia`, `taxa_erro_recente` e `capacidade_dia_horas` validas.
2. Crie varios pedidos pendentes normais com `tempoGcodeHoras` alto.
3. Crie um novo pedido normal.
4. Verifique que `eta_horas_estimado` do novo pedido aumenta conforme cresce a soma dos pedidos pendentes.
5. Verifique que `buffer_prioridade_horas` e maior que zero para pedido normal e zero para pedido com `prioridadePaga=true`.

## Cenario 4: material carregado reativa uma espera

1. Crie um pedido cujo `id_material` nao esteja em nenhum slot elegivel.
2. Chame `POST /fila/reescalonar` e confirme uma alocacao
   `aguardando_filamento`, com `numero_slot_planejado = NULL`.
3. Carregue exatamente esse material em um slot permitido pela rota de slots.
4. Confirme que o replanejamento oficial passa a registrar `na_fila`, o slot
   carregado e `requer_troca_manual = 0`.
5. Repita tentando trocar o slot com a impressora `Reservada` ou `Imprimindo` e
   confirme resposta 409, sem mutacao.

## Teste fisico CFS (bloqueado por padrao)

Nao execute envio fisico ate que o contrato LAN esteja comprovado nos dois
modelos. O adapter real deve responder `CFS_MAPPING_UNSUPPORTED` e nunca usar o
inicio Moonraker comum como fallback.

Para liberar uma implementacao futura, capture de forma sanitizada dois envios
do mesmo G-code pequeno pelo Creality Print, alterando somente o slot 1 para o
slot 2. Registre, sem credenciais, endpoint, porta, autenticacao, inventario,
`open_cfs`, mapeamento logico/fisico, resposta do comando e confirmacao do
estado de impressao. Valide separadamente na K2 Pro e na Creality Hi.

As dimensoes confiaveis da peca ainda nao sao persistidas pelo fluxo atual;
portanto a heuristica nao inventa medidas nem filtra por tamanho de mesa nesta
etapa.

## Falha de inicio ambigua

1. Em ambiente DUMMY/teste, simule uma submissao aceita cujo polling nao chega
   a `Imprimindo` dentro do timeout.
2. Confirme que `pedido_impressora` continua `reservado`.
3. Confirme que a impressora fica `Erro` e conserva `id_pedido_atual`.
4. Confirme que outra varredura nao reserva nem envia novamente o pedido.
5. Faca o status simulado passar a `Imprimindo` e sincronize; confirme que a
   transicao para `em_impressao` ocorre apenas depois dessa evidencia fisica.
