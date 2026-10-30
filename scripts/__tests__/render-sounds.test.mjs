// node --test scripts/__tests__   (npm run test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RATE, SOUNDS, mix, peakOf, renderAll, wavFile } from '../render-sounds.mjs';

test('writes a 16-bit mono PCM WAV header that matches its data', () => {
  const file = wavFile(new Float64Array([0, 0.5, -0.5, 1]));
  assert.equal(file.toString('ascii', 0, 4), 'RIFF');
  assert.equal(file.toString('ascii', 8, 12), 'WAVE');
  assert.equal(file.readUInt16LE(20), 1, 'PCM');
  assert.equal(file.readUInt16LE(22), 1, 'mono');
  assert.equal(file.readUInt32LE(24), RATE);
  assert.equal(file.readUInt16LE(34), 16);
  assert.equal(file.readUInt32LE(40), 8, 'four samples of two bytes');
  assert.equal(file.readUInt32LE(4), file.length - 8);
  assert.equal(file.readInt16LE(44 + 6), 32767, 'full scale stays in range');
});

test('a note starts and ends near silence, so it never clicks', () => {
  const samples = mix(SOUNDS.done);
  assert.ok(Math.abs(samples[0]) < 0.001);
  assert.ok(Math.abs(samples[samples.length - 1]) < 0.001);
});

test('levels every sound together: the loudest reaches the peak and none clip', () => {
  const rendered = renderAll();
  assert.deepEqual(rendered.map(([name]) => name).sort(), Object.keys(SOUNDS).sort());
  const peaks = rendered.map(([, samples]) => peakOf(samples));
  assert.ok(Math.abs(Math.max(...peaks) - 0.7) < 1e-9);
  for (const peak of peaks) assert.ok(peak > 0.05 && peak <= 0.7);
});

test('the sounds stay short enough to never hold up the next scan', () => {
  for (const [name, samples] of renderAll()) assert.ok(samples.length / RATE < 0.4, `${name} is too long`);
});
