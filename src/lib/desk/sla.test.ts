import test from "node:test";
import assert from "node:assert/strict";
import { computeDueAt } from "./sla";

test("crítica: 1 hora corrida", () => {
  const d = computeDueAt("Crítica", new Date(2026, 9, 28, 22, 0));
  assert.equal(d.getHours(), 23);
});

test("alta: 4 horas úteis atravessam o fim do expediente", () => {
  const d = computeDueAt("Alta", new Date(2026, 9, 28, 16, 0)); // quarta 16h
  assert.equal(d.getDate(), 29);
  assert.equal(d.getHours(), 10);
});

test("alta: sexta tarde cai na segunda", () => {
  const d = computeDueAt("Alta", new Date(2026, 9, 30, 17, 0)); // sexta 17h
  assert.equal(d.getDay(), 1);
  assert.equal(d.getHours(), 11);
});

test("média: 3 dias úteis pulando fim de semana", () => {
  const d = computeDueAt("Média", new Date(2026, 9, 29, 9, 0)); // quinta
  assert.equal(d.getDay(), 2); // terça
});
