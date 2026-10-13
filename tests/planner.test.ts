import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  today,
  addDays,
  dayLabel,
  attention,
  reason,
  score,
  suggestions,
  newTask,
  type Task,
} from '../lib/planner';

describe('Planner Logic Tests', () => {
  it('addDays correctly computes future and past dates using UTC', () => {
    assert.equal(addDays('2026-10-15', 1), '2026-10-16');
    assert.equal(addDays('2026-10-15', 7), '2026-10-22');
    assert.equal(addDays('2026-10-15', -5), '2026-10-10');
  });

  it('dayLabel produces non-empty formatted string', () => {
    assert.equal(dayLabel(''), '');
    const label = dayLabel('2026-10-20');
    assert.ok(label.length > 0);
  });

  it('newTask initializes with standard sensible defaults', () => {
    const task = newTask('Terminar informe');
    assert.equal(task.title, 'Terminar informe');
    assert.equal(task.status, 'inbox');
    assert.equal(task.area, 'Personal');
    assert.equal(task.priority, 2);
    assert.equal(task.minutes, 30);
    assert.equal(task.top, false);
    assert.ok(task.id);
  });

  it('attention flags overdue deadlines, plans, and follow-ups', () => {
    const base = newTask('Test');
    const todayStr = '2026-10-15';

    // Normal task in future
    const normal = { ...base, deadline: '2026-10-20' };
    assert.equal(attention(normal, todayStr), false);

    // Overdue deadline
    const overdueDeadline = { ...base, deadline: '2026-10-14' };
    assert.equal(attention(overdueDeadline, todayStr), true);

    // Past plan date
    const pastPlan = { ...base, planDate: '2026-10-10' };
    assert.equal(attention(pastPlan, todayStr), true);

    // Due follow up
    const dueFollowUp = { ...base, followUp: '2026-10-15' };
    assert.equal(attention(dueFollowUp, todayStr), true);

    // Done task should NOT trigger attention even if overdue
    const doneTask = { ...base, deadline: '2026-10-10', status: 'done' as const };
    assert.equal(attention(doneTask, todayStr), false);
  });

  it('score prioritizes overdue tasks, tasks in progress and high priority', () => {
    const todayStr = '2026-10-15';
    const low = newTask('Baja');
    low.priority = 1;

    const high = newTask('Alta');
    high.priority = 3;

    assert.ok(score(high, todayStr) > score(low, todayStr));

    const doing = { ...low, status: 'doing' as const };
    assert.ok(score(doing, todayStr) > score(low, todayStr));

    const overdue = { ...low, deadline: '2026-10-10' };
    assert.ok(score(overdue, todayStr) > score(high, todayStr));
  });

  it('suggestions fits tasks within daily budget and limits to available slots', () => {
    const todayStr = '2026-10-15';
    const t1 = { ...newTask('T1'), priority: 3, minutes: 40 };
    const t2 = { ...newTask('T2'), priority: 3, minutes: 50 };
    const t3 = { ...newTask('T3'), priority: 3, minutes: 60 };
    const t4 = { ...newTask('T4'), priority: 1, minutes: 10 };

    // Budget of 100 min: picks t1 (40) and t2 (50), skips t3 (60 > 10 left), and packs t4 (10 <= 10 left)
    const chosen = suggestions([t1, t2, t3, t4], todayStr, 100);
    assert.equal(chosen.length, 3);
    assert.ok(chosen.some((t) => t.id === t1.id));
    assert.ok(chosen.some((t) => t.id === t2.id));
    assert.ok(chosen.some((t) => t.id === t4.id));
    assert.ok(!chosen.some((t) => t.id === t3.id));
  });

  it('suggestions does not include waiting or done tasks', () => {
    const todayStr = '2026-10-15';
    const waitingTask = { ...newTask('Esperando'), status: 'waiting' as const, priority: 3, minutes: 20 };
    const doneTask = { ...newTask('Hecha'), status: 'done' as const, priority: 3, minutes: 20 };
    const regular = { ...newTask('Regular'), status: 'todo' as const, priority: 2, minutes: 30 };

    const chosen = suggestions([waitingTask, doneTask, regular], todayStr, 120);
    assert.equal(chosen.length, 1);
    assert.equal(chosen[0].id, regular.id);
  });
});
