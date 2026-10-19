import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStormWeather } from '../src/sandstorm.js';

test('storms arrive occasionally, build up, subside and leave a calm interval', () => {
  const storm = createStormWeather(() => 0);
  for (let i = 0; i < 44; i++) assert.equal(storm.update(1), 0);
  assert.equal(storm.update(1), 0);
  const ramp = Array.from({ length: 12 }, () => storm.update(1));
  assert(ramp[0] > 0 && ramp[0] < 0.1);
  assert.equal(ramp.at(-1), 1);
  for (let i = 0; i < 42; i++) assert.equal(storm.update(1), 1);
  const decay = storm.update(1);
  assert(decay > 0 && decay < 1);
  for (let i = 0; i < 15; i++) storm.update(1);
  assert.equal(storm.snapshot().duration, 0);
  assert.equal(storm.snapshot().wait, 180);
});
test('pause freezes weather and a saved storm resumes at the same intensity', () => {
  const storm = createStormWeather(() => 0);
  for (let i = 0; i < 51; i++) storm.update(1);
  const saved = storm.snapshot();
  const intensity = storm.update(0);
  for (let i = 0; i < 30; i++) assert.equal(storm.update(0), intensity);
  const loaded = createStormWeather(); loaded.restore(saved);
  assert.equal(loaded.update(0), intensity);
  loaded.reset(); assert.equal(loaded.update(0), 0);
});

test('warning appears 15 seconds before each storm and survives save/load', () => {
  let warnings = 0;
  const storm = createStormWeather(() => 0, () => warnings++);
  for (let i = 0; i < 29; i++) storm.update(1);
  assert.equal(warnings, 0);
  storm.update(1); assert.equal(warnings, 1);
  const saved = storm.snapshot();
  const loaded = createStormWeather(() => 0, () => warnings++); loaded.restore(saved);
  for (let i = 0; i < 90; i++) loaded.update(1);
  assert.equal(warnings, 1);
  for (let i = 0; i < 160; i++) loaded.update(1);
  assert.equal(warnings, 2);
});

test('the all-clear fires exactly once at the end, including a loaded storm', () => {
  let endings = 0;
  const storm = createStormWeather(() => 0, () => {}, () => endings++);
  storm.restore({ wait: 0, age: 69, duration: 70, warned: true });
  storm.update(0); assert.equal(endings, 0);
  assert.equal(storm.update(1), 0);
  assert.equal(endings, 1);
  for (let i = 0; i < 20; i++) storm.update(1);
  assert.equal(endings, 1);
  storm.reset(); assert.equal(endings, 1);
});
