import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTelegramTask } from '../lib/telegram-parser';

describe('Telegram Parser Tests', () => {
  const refDate = '2026-10-15';

  it('parses a simple text message with defaults', () => {
    const parsed = parseTelegramTask('Comprar leche');
    assert.equal(parsed.title, 'Comprar leche');
    assert.equal(parsed.area, 'Personal');
    assert.equal(parsed.priority, 2);
    assert.equal(parsed.minutes, 30);
    assert.equal(parsed.planDate, '');
    assert.equal(parsed.status, 'inbox');
  });

  it('extracts area tags correctly', () => {
    const t1 = parseTelegramTask('Terminar reporte #trabajo');
    assert.equal(t1.title, 'Terminar reporte');
    assert.equal(t1.area, 'Trabajo');

    const t2 = parseTelegramTask('Estudiar algoritmos #estudio');
    assert.equal(t2.title, 'Estudiar algoritmos');
    assert.equal(t2.area, 'Estudio');

    const t3 = parseTelegramTask('#proyectos Lanzar v2');
    assert.equal(t3.title, 'Lanzar v2');
    assert.equal(t3.area, 'Proyectos');
  });

  it('extracts priority tags correctly', () => {
    const t1 = parseTelegramTask('Pagar luz !alta');
    assert.equal(t1.title, 'Pagar luz');
    assert.equal(t1.priority, 3);

    const t2 = parseTelegramTask('Revisar correo !baja');
    assert.equal(t2.title, 'Revisar correo');
    assert.equal(t2.priority, 1);

    const t3 = parseTelegramTask('Reunión !2');
    assert.equal(t3.title, 'Reunión');
    assert.equal(t3.priority, 2);
  });

  it('extracts duration correctly in minutes or hours', () => {
    const t1 = parseTelegramTask('Rutina de ejercicios 45m');
    assert.equal(t1.title, 'Rutina de ejercicios');
    assert.equal(t1.minutes, 45);

    const t2 = parseTelegramTask('Taller de capacitación 2h');
    assert.equal(t2.title, 'Taller de capacitación');
    assert.equal(t2.minutes, 120);

    const t3 = parseTelegramTask('Curso online 1h30m');
    assert.equal(t3.title, 'Curso online');
    assert.equal(t3.minutes, 90);
  });

  it('extracts plan dates (hoy, mañana, explicit)', () => {
    const tHoy = parseTelegramTask('Llamar a Juan hoy', refDate);
    assert.equal(tHoy.title, 'Llamar a Juan');
    assert.equal(tHoy.planDate, '2026-10-15');
    assert.equal(tHoy.status, 'todo');

    const tManana = parseTelegramTask('Comprar insumos mañana', refDate);
    assert.equal(tManana.title, 'Comprar insumos');
    assert.equal(tManana.planDate, '2026-10-16');
    assert.equal(tManana.status, 'todo');

    const tExplicit = parseTelegramTask('Entregar proyecto 2026-10-25', refDate);
    assert.equal(tExplicit.title, 'Entregar proyecto');
    assert.equal(tExplicit.planDate, '2026-10-25');
    assert.equal(tExplicit.status, 'todo');
  });

  it('parses complex message with all tags combined', () => {
    const parsed = parseTelegramTask('Preparar presentación de ventas #trabajo !alta hoy 45m', refDate);
    assert.equal(parsed.title, 'Preparar presentación de ventas');
    assert.equal(parsed.area, 'Trabajo');
    assert.equal(parsed.priority, 3);
    assert.equal(parsed.minutes, 45);
    assert.equal(parsed.planDate, '2026-10-15');
    assert.equal(parsed.status, 'todo');
  });
});
