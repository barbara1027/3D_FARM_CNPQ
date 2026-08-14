/**
 * Fonte única de cálculo de tempo operacional (horas úteis da jornada da farm).
 *
 * Antes desta unidade, `EtaEntregaService` e a heurística de fila usavam
 * definições diferentes de "horas restantes" (uma operacional, outra corrida).
 * Todo cálculo de ETA e de fila deve passar por aqui.
 *
 * Jornada configurável via `.env`:
 *   JORNADA_INICIO_HORA — hora local de início do expediente (padrão 8)
 *   JORNADA_HORAS_DIA   — duração diária do expediente em horas (padrão 8)
 *
 * Apenas horas dentro de [JORNADA_INICIO_HORA, JORNADA_INICIO_HORA + JORNADA_HORAS_DIA)
 * contam como tempo operacional; o restante do dia (noite/madrugada) é ignorado.
 */

const JORNADA_INICIO_HORA_PADRAO = 8;
const JORNADA_HORAS_DIA_PADRAO = 8;
const MS_POR_HORA = 60 * 60 * 1000;

function normalizarNumeroPositivo(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Hora de início do expediente configurada (0-23), lida a cada chamada. */
export function getJornadaInicioHora(): number {
  const inicio = normalizarNumeroPositivo(
    process.env.JORNADA_INICIO_HORA,
    JORNADA_INICIO_HORA_PADRAO,
  );
  return Math.max(0, Math.min(23, Math.floor(inicio)));
}

/** Duração diária do expediente configurada, em horas. */
export function getJornadaHorasDia(): number {
  return normalizarNumeroPositivo(process.env.JORNADA_HORAS_DIA, JORNADA_HORAS_DIA_PADRAO);
}

/** Duração efetiva da jornada, sem ultrapassar a virada do dia. */
function duracaoJornadaEfetiva(horaInicio: number, horasPorDia: number): number {
  return Math.min(24 - horaInicio, normalizarNumeroPositivo(horasPorDia, JORNADA_HORAS_DIA_PADRAO));
}

/**
 * Soma `horasOperacionais` a `dataInicial`, pulando os períodos fora da jornada.
 *
 * Exemplo (jornada 08:00–16:00): partindo de 15:00 e somando 4h operacionais,
 * consome 1h hoje (até as 16:00) e 3h no próximo período operacional
 * (08:00–11:00 do dia seguinte), resultando em 11:00 do dia seguinte.
 */
export function adicionarHorasOperacionais(
  dataInicial: Date,
  horasOperacionais: number,
  horaInicioExpediente = getJornadaInicioHora(),
  horasPorDia = getJornadaHorasDia(),
): Date {
  const inicioHora = Math.max(0, Math.min(23, Math.floor(horaInicioExpediente)));
  const duracaoDia = duracaoJornadaEfetiva(inicioHora, horasPorDia);
  const fimHora = inicioHora + duracaoDia;
  let horasRestantes = Math.max(0, Number(horasOperacionais) || 0);
  const cursor = new Date(dataInicial);

  const moverParaInicioDoDia = () => cursor.setHours(inicioHora, 0, 0, 0);
  const moverParaProximoDia = () => {
    cursor.setDate(cursor.getDate() + 1);
    moverParaInicioDoDia();
  };
  const horaDecimalAtual = () =>
    cursor.getHours() + cursor.getMinutes() / 60 + cursor.getSeconds() / 3600;

  if (horaDecimalAtual() < inicioHora) {
    moverParaInicioDoDia();
  } else if (horaDecimalAtual() >= fimHora) {
    moverParaProximoDia();
  }

  while (horasRestantes > 0) {
    const horasDisponiveisHoje = Math.max(0, fimHora - horaDecimalAtual());

    if (horasDisponiveisHoje === 0) {
      moverParaProximoDia();
      continue;
    }

    const horasConsumidas = Math.min(horasRestantes, horasDisponiveisHoje);
    cursor.setTime(cursor.getTime() + horasConsumidas * MS_POR_HORA);
    horasRestantes -= horasConsumidas;

    if (horasRestantes > 0) {
      moverParaProximoDia();
    }
  }

  return cursor;
}

/** Horas operacionais já decorridas dentro do mesmo dia de `data`, entre `horaInicio` e `fimHora`. */
function horasOperacionaisNoDia(data: Date, horaInicio: number, fimHora: number): number {
  const horaDecimal =
    data.getHours() + data.getMinutes() / 60 + data.getSeconds() / 3600 + data.getMilliseconds() / 3_600_000;

  if (horaDecimal <= horaInicio) return 0;
  if (horaDecimal >= fimHora) return fimHora - horaInicio;
  return horaDecimal - horaInicio;
}

function inicioDoDia(data: Date): Date {
  const meiaNoite = new Date(data);
  meiaNoite.setHours(0, 0, 0, 0);
  return meiaNoite;
}

/**
 * Calcula quantas horas operacionais existem entre `inicio` e `fim`, contando
 * apenas o tempo dentro da jornada. Pode retornar valores negativos quando
 * `fim` é anterior a `inicio` (útil para medir atraso já consumido).
 */
export function calcularHorasOperacionaisEntre(
  inicio: Date,
  fim: Date,
  horaInicioExpediente = getJornadaInicioHora(),
  horasPorDia = getJornadaHorasDia(),
): number {
  const horaInicio = Math.max(0, Math.min(23, Math.floor(horaInicioExpediente)));
  const duracaoDia = duracaoJornadaEfetiva(horaInicio, horasPorDia);
  const fimHora = horaInicio + duracaoDia;

  const diasEntre = Math.round(
    (inicioDoDia(fim).getTime() - inicioDoDia(inicio).getTime()) / (24 * MS_POR_HORA),
  );

  return (
    diasEntre * duracaoDia +
    horasOperacionaisNoDia(fim, horaInicio, fimHora) -
    horasOperacionaisNoDia(inicio, horaInicio, fimHora)
  );
}
