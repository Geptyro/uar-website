/** Unit tests for feedback form validation (npm test). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	validateFeedback,
	MESSAGE_MAX,
	NAME_MAX,
	CONTACT_MAX
} from '../src/lib/feedback.ts';

const input = (over: Record<string, unknown>) => ({
	message: 'This unit page shows the wrong damage value.',
	name: '',
	contact: '',
	website: '',
	...over
});

test('valid message alone passes, optional fields omitted', () => {
	const v = validateFeedback(input({}));
	assert.ok(v.ok);
	assert.deepEqual(v.fields, { message: 'This unit page shows the wrong damage value.' });
});

test('name and contact are trimmed and included when present', () => {
	const v = validateFeedback(input({ name: '  Znimu ', contact: ' someone@example.com ' }));
	assert.ok(v.ok);
	assert.equal(v.fields.name, 'Znimu');
	assert.equal(v.fields.contact, 'someone@example.com');
});

test('message is trimmed before length check', () => {
	const v = validateFeedback(input({ message: '   short   ' }));
	assert.ok(!v.ok); // "short" is 5 chars < MESSAGE_MIN
});

test('too-short and empty messages are rejected', () => {
	assert.ok(!validateFeedback(input({ message: '' })).ok);
	assert.ok(!validateFeedback(input({ message: 'hi' })).ok);
});

test('overlong fields are rejected', () => {
	assert.ok(!validateFeedback(input({ message: 'x'.repeat(MESSAGE_MAX + 1) })).ok);
	assert.ok(!validateFeedback(input({ name: 'x'.repeat(NAME_MAX + 1) })).ok);
	assert.ok(!validateFeedback(input({ contact: 'x'.repeat(CONTACT_MAX + 1) })).ok);
});

test('exactly max-length message passes', () => {
	assert.ok(validateFeedback(input({ message: 'x'.repeat(MESSAGE_MAX) })).ok);
});

test('filled honeypot rejects the submission', () => {
	assert.ok(!validateFeedback(input({ website: 'https://spam.example' })).ok);
});

test('non-string fields are treated as empty, not crashes', () => {
	assert.ok(!validateFeedback(input({ message: null })).ok);
	assert.ok(!validateFeedback(input({ message: 42 })).ok);
	const v = validateFeedback(input({ name: undefined, contact: 7, website: null }));
	assert.ok(v.ok);
	assert.deepEqual(v.fields, { message: 'This unit page shows the wrong damage value.' });
});
