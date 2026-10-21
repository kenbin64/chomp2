// Tests for js/feedback-rules.js: the feedback and takedown form.
// Run:  node test/feedback.test.mjs

import { checkFeedback, emailText, KINDS, LIMITS } from '../js/feedback-rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

const good = { kind: 'feedback', name: 'Aunty May', reply: 'may@example.com', message: 'Love the Esplanade! Could Wally visit Green Island?', page: 'about' };
const r = checkFeedback(good);
check('a normal message is accepted', r.ok && r.entry.kind === 'feedback' && r.entry.message.startsWith('Love'));
check('no name and no reply address is fine for feedback', checkFeedback({ kind: 'bug', message: 'The cane level froze.' }).ok);
check('a takedown notice needs a reply address', checkFeedback({ kind: 'takedown', message: 'That is my photo.' }).error === 'reply' && checkFeedback({ kind: 'takedown', message: 'That is my photo.', reply: 'a@b.co' }).ok);
check('a bad reply address is refused', checkFeedback({ ...good, reply: 'not an email' }).error === 'reply' && checkFeedback({ ...good, reply: 'a@b' }).error === 'reply');
check('an empty or tiny message is refused', checkFeedback({ ...good, message: '  ' }).error === 'message' && checkFeedback({ ...good, message: 'hi' }).error === 'message');
check('an unknown kind is refused', checkFeedback({ ...good, kind: 'sales' }).error === 'kind' && checkFeedback({ ...good, kind: 'toString' }).error === 'kind');
check('the robot trap: the hidden field filled in means spam', checkFeedback({ ...good, website: 'http://spam.example' }).error === 'spam');
check('nothing at all is refused, without throwing', checkFeedback(null).error === 'empty' && checkFeedback('text').error === 'empty');
check('a very long message is cut to the limit, not refused', checkFeedback({ ...good, message: 'x'.repeat(LIMITS.message + 500) }).entry.message.length === LIMITS.message);
const sneaky = checkFeedback({ ...good, name: 'Bob\r\nBcc: everyone@example.com', page: 'a\nb' }).entry;
check('no line breaks can sneak into the name or page (no extra email headers)', !/[\r\n]/.test(sneaky.name) && !/[\r\n]/.test(sneaky.page));
check('control characters are taken out', checkFeedback({ ...good, message: 'hello\u0000 there\u0007!' }).entry.message === 'hello there!');
check('line breaks in the message itself are kept', checkFeedback({ ...good, message: 'line one\nline two' }).entry.message.includes('\n'));
const mail = emailText(r.entry, new Date('2026-10-21T00:00:00Z'));
check('the email says what kind, who, how to reply and the words', mail.subject.includes(KINDS.feedback) && mail.subject.includes('Aunty May') && mail.text.includes('may@example.com') && mail.text.includes('Green Island'));
check('the subject never carries a line break', !/[\r\n]/.test(emailText(sneaky).subject));

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
