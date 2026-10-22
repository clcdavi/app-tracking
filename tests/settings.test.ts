import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  settingsSchema,
  DEFAULT_SETTINGS,
  normalizeSettings,
  timeToMinutes,
  minutesToTime,
} from '../lib/settings';

describe('Settings & Time Utilities Tests', () => {
  it('DEFAULT_SETTINGS satisfies settingsSchema', () => {
    const parsed = settingsSchema.safeParse(DEFAULT_SETTINGS);
    assert.equal(parsed.success, true);
  });

  it('normalizeSettings fills missing fields with defaults', () => {
    const normalized = normalizeSettings({ dailyBudget: 180 });
    assert.equal(normalized.dailyBudget, 180);
    assert.equal(normalized.workdayStart, DEFAULT_SETTINGS.workdayStart);
    assert.equal(normalized.focusMinutes, DEFAULT_SETTINGS.focusMinutes);
    assert.equal(normalized.morningBriefing.enabled, true);
    assert.equal(normalized.theme, 'dark');
  });

  it('normalizeSettings handles empty or invalid object gracefully', () => {
    const normalized = normalizeSettings(null);
    assert.deepEqual(normalized, DEFAULT_SETTINGS);

    const withBadTypes = normalizeSettings({
      dailyBudget: 'not-a-number',
      workdayStart: 'invalid-time',
    });
    assert.equal(withBadTypes.dailyBudget, DEFAULT_SETTINGS.dailyBudget);
    assert.equal(withBadTypes.workdayStart, DEFAULT_SETTINGS.workdayStart);
  });

  it('timeToMinutes converts HH:MM correctly', () => {
    assert.equal(timeToMinutes('00:00'), 0);
    assert.equal(timeToMinutes('09:00'), 540);
    assert.equal(timeToMinutes('14:30'), 870);
    assert.equal(timeToMinutes('23:59'), 1439);
  });

  it('minutesToTime converts minutes into HH:MM correctly', () => {
    assert.equal(minutesToTime(0), '00:00');
    assert.equal(minutesToTime(540), '09:00');
    assert.equal(minutesToTime(870), '14:30');
    assert.equal(minutesToTime(1439), '23:59');
  });

  it('time conversion round-trips accurately', () => {
    for (const time of ['08:00', '09:15', '12:30', '17:45', '20:00', '23:59']) {
      assert.equal(minutesToTime(timeToMinutes(time)), time);
    }
  });
});
