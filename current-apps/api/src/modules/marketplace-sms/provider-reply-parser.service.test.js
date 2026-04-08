import test from 'node:test';
import assert from 'node:assert/strict';

import { parseProviderReply } from './provider-reply-parser.service.js';

test('parseProviderReply captures accept commands with a job code reference', () => {
  const parsed = parseProviderReply('YES ABC123');

  assert.equal(parsed.status, 'accepted');
  assert.equal(parsed.requestReference, 'ABC123');
});

test('parseProviderReply captures decline commands with a job code reference', () => {
  const parsed = parseProviderReply('no 69CABC');

  assert.equal(parsed.status, 'declined');
  assert.equal(parsed.requestReference, '69CABC');
});

test('parseProviderReply still handles STOP and HELP without a request reference', () => {
  assert.equal(parseProviderReply('STOP').status, 'opted_out');
  assert.equal(parseProviderReply('HELP').status, 'help');
});
