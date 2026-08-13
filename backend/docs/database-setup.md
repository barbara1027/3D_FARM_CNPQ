# Configuração canônica do banco MySQL

Este é o procedimento oficial para preparar o banco do backend. Ele se aplica somente a um banco novo e vazio. O `db:init` não atualiza, limpa nem recria um banco existente.

## Requisitos

- MySQL 8.0.16 ou superior. MariaDB não é aceito pelo inicializador.
- Dependências do backend instaladas com `npm install`.
- Um usuário MySQL com permissão para criar o banco configurado e suas tabelas.

A versão mínima é necessária porque, a partir do MySQL 8.0.16, as `CHECK constraints` usadas pelo projeto são efetivamente aplicadas.

## 1. Configurar o `.env`

No diretório `backend`, copie o exemplo e ajuste os valores para o ambiente local:

```bash
cp .env.example .env
```

As cinco variáveis de conexão são obrigatórias:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=3d_farm_app
DB_PASSWORD=change_me
DB_NAME=3d_farm
```

- `DB_PORT` deve ser um inteiro entre 1 e 65535.
- `DB_NAME` aceita somente letras ASCII, números e underscore, com 1 a 64 caracteres, e não pode ser o nome de um schema interno do MySQL.
- `DB_PASSWORD` é obrigatória e não pode ser vazia.
- Credenciais não são incluídas nas mensagens de erro.

Para habilitar o seed opcional de desenvolvimento, configure também:

```env
NODE_ENV=development
DB_SEED_CONFIRM=3d_farm
DEV_SEED_PASSWORD=uma_senha_local_com_12_ou_mais_caracteres
```

`DB_SEED_CONFIRM` deve ser exatamente igual a `DB_NAME`. Não habilite essas proteções em produção.

## 2. Fonte oficial da estrutura

A única fonte editável da estrutura é `src/database/tables/`. Os arquivos são carregados nesta ordem determinística:

1. `001_create_usuarios.sql`
2. `002_create_materiais.sql`
3. `003_create_qualidades.sql`
4. `004_create_arquivos.sql`
5. `005_create_pedidos.sql`
6. `006_create_impressoras.sql`
7. `007_create_impressora_slots_filamento.sql`
8. `007_create_pedido_impressora.sql`
9. `008_create_impressora_eventos.sql`
10. `009_create_chat_mensagens.sql`
11. `010_add_arquivos_pedido_fk.sql`

Os dez primeiros arquivos criam as dez tabelas funcionais. O arquivo `010` adiciona somente a chave estrangeira circular de `arquivos.id_pedido`, depois que `pedidos` já existe. Não execute esses arquivos individualmente; `npm run db:init` é o único inicializador oficial.

Todas as tabelas usam InnoDB, `utf8mb4` e `utf8mb4_unicode_ci`.

## 3. Fluxo oficial

Depois de configurar o `.env`, execute no diretório `backend`:

```bash
npm run db:init
npm run db:verify

# Opcional e somente para desenvolvimento:
npm run db:seed

npm run dev
```

Não há comando `db:reset`. Essa ausência é intencional: nenhum comando do projeto deve apagar dados ou recriar automaticamente um banco configurado.

## Comportamento do `db:init`

O inicializador:

1. valida todas as variáveis de conexão e a versão do servidor;
2. obtém um lock por banco para impedir duas inicializações simultâneas;
3. cria `DB_NAME`, caso ainda não exista, com o charset e a collation oficiais;
4. confirma que o banco não contém tabelas ou outros objetos listados por `information_schema.TABLES`;
5. executa os arquivos de `src/database/tables/` na ordem oficial;
6. informa o arquivo que falhou sem exibir credenciais.

Se o banco já contiver qualquer tabela ou view, a execução é recusada antes de alterar a estrutura ou os dados. Um banco vazio com charset ou collation diferente também é recusado. O inicializador não é executado automaticamente quando a API inicia.

Operações DDL do MySQL não são revertidas como uma transação comum. Portanto, se houver falha depois da criação de alguma tabela, o estado parcial é preservado para diagnóstico e nenhuma limpeza automática é feita. Para repetir com segurança, aponte o `.env` para outro `DB_NAME` claramente descartável e inexistente; nunca remova automaticamente um banco real.

Se for necessário descartar uma criação parcial de teste, confirme primeiro o nome literal. Este exemplo remove somente dois nomes explicitamente reservados para validação:

```bash
mysql -h 127.0.0.1 -u 3d_farm_app -p -e \
  "DROP DATABASE IF EXISTS \`3d_farm_schema_test_a\`; DROP DATABASE IF EXISTS \`3d_farm_schema_test_b\`;"
```

Não substitua esses nomes por uma variável não validada e não use esse comando contra o banco de desenvolvimento ou produção.

## Comportamento do `db:verify`

O verificador consulta `information_schema` e compara o banco com os arquivos oficiais. Ele valida:

- as dez tabelas esperadas, sem tabelas extras;
- colunas, ordem, tipos, signedness, nulabilidade e atributos especiais;
- chaves primárias e estrangeiras, inclusive regras de atualização e exclusão;
- índices comuns e únicos;
- nomes das `CHECK constraints` e confirmação de que estão aplicadas;
- engine, charset e collation.

Qualquer divergência é listada e encerra o comando com código diferente de zero. Execute-o logo após `db:init` e antes de iniciar a API ou popular o banco.

## Seed de desenvolvimento

`npm run db:seed` é opcional e cria somente dados genéricos de demonstração. Antes de inserir qualquer linha, ele:

- exige `NODE_ENV=development`;
- exige `DB_SEED_CONFIRM` idêntico a `DB_NAME`;
- exige `DEV_SEED_PASSWORD` com pelo menos 12 caracteres;
- executa a mesma verificação estrutural de `db:verify`;
- confirma que todas as dez tabelas estão sem dados.

As inserções usam transação e lock por banco. Se uma tabela já estiver populada, o seed é recusado sem apagar ou substituir dados. As impressoras de demonstração usam o protocolo `DUMMY`: K2 Pro e Creality Hi possuem CFS com dois slots ocupados, enquanto a Ender 3 V3 SE não possui CFS e usa somente o slot 1. A alocação demonstrativa em `pedido_impressora` planeja o material PLA já carregado no slot 1 da K2 Pro e, por isso, registra `numero_slot_planejado = 1` e `requer_troca_manual = 0`.

## Timezone

O pool da API, `db:init` e `db:verify` configuram a conexão MySQL com timezone `Z` e executam `SET SESSION time_zone = '+00:00'`. Datas operacionais em `DATETIME` são tratadas como UTC, e os timestamps de criação e atualização seguem a sessão UTC. Só acrescente o sufixo `Z` a uma data serializada quando o valor realmente representar UTC.

## Impressoras

O protocolo seguro e padrão da coluna `impressoras.api` é `DUMMY`, usado para desenvolvimento e pelo seed. Impressoras físicas do projeto devem usar `MOONRAKER`. `OCTOPRINT` continua aceito apenas por compatibilidade e não é o padrão.

Cada impressora registra `possui_cfs`, `largura_mesa_mm` e `profundidade_mesa_mm`. As dimensões são obrigatórias, expressas em milímetros e devem ser maiores que zero.

Os filamentos carregados ficam normalizados em `impressora_slots_filamento`. A chave primária composta garante um material por slot; slots vazios não geram registros. Impressoras com CFS podem usar os slots de 1 a 4, enquanto impressoras sem CFS podem usar somente o slot 1. A aplicação impede desativar o CFS enquanto houver filamentos nos slots 2, 3 ou 4.

Ao excluir uma impressora, seus slots são removidos em cascata. Materiais carregados não podem ser excluídos enquanto forem referenciados.

## Planejamento da fila em `pedido_impressora`

`pedido_impressora` é a estrutura canônica do planejamento executável. Cada alocação registra a impressora, a posição naquela fila e, quando o material já está carregado, o `numero_slot_planejado`. O campo `requer_troca_manual` distingue uma alocação que depende de intervenção do operador; seu valor padrão é zero.

Os estados possíveis são `na_fila`, `reservado`, `aguardando_filamento`, `em_impressao`, `concluido`, `falhou` e `cancelado`. Para impedir duas alocações ativas do mesmo pedido, a coluna gerada `id_pedido_ativo` considera ativos os quatro primeiros estados e possui um índice único. O índice operacional `(id_impressora, status, posicao_fila)` determina o acesso à ordem planejada de cada impressora.

`numero_slot_planejado` aceita somente os slots 1 a 4 ou `NULL`. Ele não possui chave estrangeira para `impressora_slots_filamento`, pois o conteúdo físico de um slot pode mudar depois do planejamento e deve ser revalidado antes da impressão.

Falhas comprovadamente anteriores ao início físico usam `tentativas_inicio` e `proxima_tentativa_em`. A alocação volta para `na_fila` com espera exponencial entre tentativas; ao atingir o limite operacional, a alocação e o pedido são marcados como `falhou`. Esses campos são persistentes para que a varredura periódica não repita indefinidamente um envio com erro.

Quando uma chamada externa pode ter sido aceita, o sistema não libera nem
reagenda a alocação: ela permanece `reservado`, e a impressora fica bloqueada
em `Erro` conservando `id_pedido_atual`. Isso evita um segundo envio enquanto o
equipamento talvez esteja imprimindo. Uma queda do processo logo depois da
reserva também pode exigir reconciliação operacional; não existe liberação
automática baseada apenas em tempo, porque ela seria insegura sem consultar o
estado físico.

O saldo da capacidade diária usado no replanejamento desconta
`horas_usadas_hoje` quando `data_referencia_capacidade = CURDATE()`.

### Teste concorrente opcional

`npm run test:mysql-integration` é desativado por padrão. A suíte somente abre
conexão quando recebe `RUN_MYSQL_INTEGRATION_TESTS=1`,
`CONFIRM_MYSQL_INTEGRATION_DB=1` e todas as variáveis
`MYSQL_INTEGRATION_HOST`, `MYSQL_INTEGRATION_PORT`,
`MYSQL_INTEGRATION_USER`, `MYSQL_INTEGRATION_PASSWORD` e
`MYSQL_INTEGRATION_DB_NAME`. O nome do banco deve terminar em `_test`, estar
previamente inicializado e não conter planejamento ativo.

O teste não executa `db:init`: ele verifica a coluna gerada/índice único, a
reserva concorrente com `FOR UPDATE SKIP LOCKED` e a preservação de uma
alocação reservada durante o replanejamento.

## Erro MySQL 3780

O erro 3780 ocorria quando uma chave estrangeira e a chave referenciada tinham tipos incompatíveis. A estrutura oficial usa `INT UNSIGNED` de forma consistente em todas as PKs e FKs numéricas relacionadas, eliminando a diferença de signedness.

Se esse erro aparecer, não tente adaptar o banco existente: confirme a divergência com `npm run db:verify` e inicialize outro banco novo e vazio pelo fluxo oficial. O `db:init` não corrige estruturas preexistentes.

## Roteiro para validação descartável

Este roteiro é separado do procedimento oficial e deve ser usado somente em um servidor MySQL de teste. Ele comprova a recusa da segunda inicialização e a reprodução em dois bancos independentes:

```bash
cd backend

DB_NAME=3d_farm_schema_test_a npm run db:init
DB_NAME=3d_farm_schema_test_a npm run db:verify
DB_NAME=3d_farm_schema_test_a npm run db:init  # deve falhar sem alterar o banco

DB_NAME=3d_farm_schema_test_b npm run db:init
DB_NAME=3d_farm_schema_test_b npm run db:verify

NODE_ENV=development \
DB_NAME=3d_farm_schema_test_b \
DB_SEED_CONFIRM=3d_farm_schema_test_b \
npm run db:seed
```

Depois dos testes, confira literalmente os dois nomes antes de usar o comando de limpeza mostrado acima.
