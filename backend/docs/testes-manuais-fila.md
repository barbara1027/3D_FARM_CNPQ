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
