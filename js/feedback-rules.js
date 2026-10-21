// feedback-rules.js
// The feedback and takedown form (Ken, 2026-10-21: a form that emails him, never his own address on the
// page). The rules are shared by the page, the local server (serve.mjs) and the hosted site's worker
// (playbutterflyfx/worker.js), and tested (test/feedback.test.mjs). Plain JavaScript, no three.js.
//
//   checkFeedback(body)  ->  { ok: true, entry } or { ok: false, error }
//   emailText(entry)     ->  { subject, text } for the message to Ken

export const KINDS = { feedback: 'Feedback or an idea', bug: 'Something is broken', culture: 'How people or culture are shown', takedown: 'Copyright or takedown notice' };
export const LIMITS = { name: 80, reply: 120, message: 4000, page: 200, minMessage: 5 };
export const PER_HOUR = 5;                       // messages a visitor may send in an hour

const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,180}\.[A-Za-z]{2,24}$/;
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '');

export function checkFeedback(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'empty' };
  if (typeof body.website === 'string' && body.website.trim()) return { ok: false, error: 'spam' };   // the hidden field only a robot fills in
  const kind = Object.hasOwn(KINDS, body.kind) ? body.kind : null;
  if (!kind) return { ok: false, error: 'kind' };
  const message = clean(body.message, LIMITS.message);
  if (message.length < LIMITS.minMessage) return { ok: false, error: 'message' };
  const reply = clean(body.reply, LIMITS.reply);
  if (reply && !EMAIL.test(reply)) return { ok: false, error: 'reply' };
  if (kind === 'takedown' && !reply) return { ok: false, error: 'reply' };          // a takedown needs a way to answer
  const name = clean(body.name, LIMITS.name).replace(/[\r\n]+/g, ' ');
  const page = clean(body.page, LIMITS.page).replace(/[\r\n]+/g, ' ');
  return { ok: true, entry: { kind, name, reply, message, page } };
}

// The email to Ken: plain text, the sender's words as they wrote them.
export function emailText(entry, when = new Date()) {
  const subject = `[Chomp 3D] ${KINDS[entry.kind]}${entry.name ? ` from ${entry.name}` : ''}`.slice(0, 150);
  const text = [
    `Kind: ${KINDS[entry.kind]}`,
    `From: ${entry.name || '(no name given)'}`,
    `Reply to: ${entry.reply || '(none given)'}`,
    `Page: ${entry.page || '(not given)'}`,
    `Sent: ${when.toISOString()}`,
    '',
    entry.message,
  ].join('\n');
  return { subject, text };
}
