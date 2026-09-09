import assert from "node:assert/strict";
import { test } from "node:test";
import { adicionarHorasOperacionais, calcularHorasOperacionaisEntre } from "./tempoOperacional";

// Jornada fixa 08:00-16:00 usada em todos os testes, independente do .env.
const INICIO = 8;
const HORAS_DIA = 8;

function data(ano: number, mes: number, dia: number, hora = 0, minuto = 0): Date {
  return new Date(ano, mes - 1, dia, hora, minuto, 0, 0);
}

test("adicionarHorasOperacionais soma horas dentro da jornada sem cruzar o fim do expediente", () => {
  const resultado = adicionarHorasOperacionais(data(2026, 1, 5, 10, 0), 2, INICIO, HORAS_DIA);
  assert.deepEqual(
    [resultado.getFullYear(), resultado.getMonth() + 1, resultado.getDate(), resultado.getHours()],
    [2026, 1, 5, 12],
  );
});

test("adicionarHorasOperacionais atravessa o fim da jornada para o proximo periodo operacional", () => {
  // Exemplo do enunciado: 15:00 + 4h operacionais = 1h hoje + 3h no dia seguinte = 11:00 do dia seguinte.
  const resultado = adicionarHorasOperacionais(data(2026, 1, 5, 15, 0), 4, INICIO, HORAS_DIA);
  assert.deepEqual(
    [resultado.getFullYear(), resultado.getMonth() + 1, resultado.getDate(), resultado.getHours()],
    [2026, 1, 6, 11],
  );
});

test("adicionarHorasOperacionais iniciado fora da jornada pula para o inicio do proximo expediente", () => {
  const resultado = adicionarHorasOperacionais(data(2026, 1, 5, 20, 0), 1, INICIO, HORAS_DIA);
  assert.deepEqual(
    [resultado.getFullYear(), resultado.getMonth() + 1, resultado.getDate(), resultado.getHours()],
    [2026, 1, 6, 9],
  );
});

test("calcularHorasOperacionaisEntre soma corretamente dentro do mesmo dia", () => {
  const horas = calcularHorasOperacionaisEntre(
    data(2026, 1, 5, 10, 0),
    data(2026, 1, 5, 14, 0),
    INICIO,
    HORAS_DIA,
  );
  assert.equal(horas, 4);
});

test("calcularHorasOperacionaisEntre calcula corretamente entre dois instantes em dias diferentes", () => {
  // 05/01 10:00 -> 07/01 10:00: 2 dias completos de 8h (05->06 e 06->07) + 2h do dia 07 - 2h ja consumidas no dia 05
  const horas = calcularHorasOperacionaisEntre(
    data(2026, 1, 5, 10, 0),
    data(2026, 1, 7, 10, 0),
    INICIO,
    HORAS_DIA,
  );
  assert.equal(horas, 16);
});

test("calcularHorasOperacionaisEntre nao conta periodo fora da jornada", () => {
  const horas = calcularHorasOperacionaisEntre(
    data(2026, 1, 5, 18, 0),
    data(2026, 1, 5, 23, 0),
    INICIO,
    HORAS_DIA,
  );
  assert.equal(horas, 0);
});

test("calcularHorasOperacionaisEntre conta exatamente a jornada quando inicio e fim coincidem com o expediente", () => {
  const horas = calcularHorasOperacionaisEntre(
    data(2026, 1, 5, 8, 0),
    data(2026, 1, 5, 16, 0),
    INICIO,
    HORAS_DIA,
  );
  assert.equal(horas, 8);
});

test("calcularHorasOperacionaisEntre retorna negativo quando fim antecede inicio", () => {
  const horas = calcularHorasOperacionaisEntre(
    data(2026, 1, 5, 14, 0),
    data(2026, 1, 5, 10, 0),
    INICIO,
    HORAS_DIA,
  );
  assert.equal(horas, -4);
});

test("adicionarHorasOperacionais e calcularHorasOperacionaisEntre sao inversas para jornadas simples", () => {
  const inicio = data(2026, 1, 5, 9, 30);
  const fim = adicionarHorasOperacionais(inicio, 5.5, INICIO, HORAS_DIA);
  const horas = calcularHorasOperacionaisEntre(inicio, fim, INICIO, HORAS_DIA);
  assert.ok(Math.abs(horas - 5.5) < 1e-9);
});

test("respeita jornada customizada diferente do padrao (09:00-17:00)", () => {
  const resultado = adicionarHorasOperacionais(data(2026, 1, 5, 16, 30), 0.5, 9, 8);
  assert.deepEqual(
    [resultado.getFullYear(), resultado.getMonth() + 1, resultado.getDate(), resultado.getHours(), resultado.getMinutes()],
    [2026, 1, 5, 17, 0],
  );
});

test("jornada customizada: ultrapassar o fim do expediente rola para o dia seguinte", () => {
  const resultado = adicionarHorasOperacionais(data(2026, 1, 5, 16, 30), 1, 9, 8);
  assert.deepEqual(
    [resultado.getFullYear(), resultado.getMonth() + 1, resultado.getDate(), resultado.getHours(), resultado.getMinutes()],
    [2026, 1, 6, 9, 30],
  );
});
