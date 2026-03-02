#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { AgentMailClient } = require('agentmail');

function usage() {
  console.error('Usage: send-ask-matt-email.js "<question>" [context]');
  process.exit(2);
}

function truncate(str, max) {
  return str.length <= max ? str : `${str.slice(0, max - 1)}…`;
}

function readStateOfAffairs(workspaceRoot) {
  const statePath = path.join(workspaceRoot, 'STATE-OF-AFFAIRS.md');
  if (!fs.existsSync(statePath)) return null;
  return fs.readFileSync(statePath, 'utf8');
}

function getConfig() {
  const workspaceRoot = process.env.WORKSPACE_ROOT || process.cwd();
  const text = readStateOfAffairs(workspaceRoot) || '';

  const apiKey =
    process.env.ASK_MATT_AGENTMAIL_API_KEY ||
    process.env.AGENTMAIL_API_KEY ||
    (text.match(/API key:\s*(am_[a-z]+_[a-f0-9]+)/i) || [])[1];

  const fromInbox =
    process.env.ASK_MATT_FROM_INBOX ||
    (text.match(/Email:\s*([^\s]+@agentmail\.to)/i) || [])[1] ||
    'tomlamont@agentmail.to';

  const toEmail =
    process.env.ASK_MATT_TO_EMAIL ||
    'matthew_newell@outlook.com';

  if (!apiKey) {
    throw new Error('AgentMail API key not found (ASK_MATT_AGENTMAIL_API_KEY / AGENTMAIL_API_KEY / STATE-OF-AFFAIRS.md)');
  }

  return { apiKey, fromInbox, toEmail };
}

async function main() {
  const [, , question, context = ''] = process.argv;
  if (!question) usage();

  const { apiKey, fromInbox, toEmail } = getConfig();
  const client = new AgentMailClient({ apiKey });

  const cleanQuestion = question.trim();
  const cleanContext = context.trim();

  const subject = `[ask-matt] ${truncate(cleanQuestion, 90)}`;
  const lines = [
    '[ask-matt] Rainmaker needs input.',
    '',
    `Question: ${cleanQuestion}`,
    cleanContext ? `Context: ${cleanContext}` : null,
    `Sent: ${new Date().toISOString()}`,
  ].filter(Boolean);

  const result = await client.inboxes.messages.send(fromInbox, {
    to: [toEmail],
    subject,
    text: lines.join('\n'),
  });

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        toEmail,
        fromInbox,
        messageId: result.messageId,
        threadId: result.threadId,
      },
      null,
      2,
    ) + '\n',
  );
}

main().catch((err) => {
  console.error('[send-ask-matt-email] failed:', err?.message || err);
  process.exit(1);
});
