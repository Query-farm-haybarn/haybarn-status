// Discord status notifications, driven by the */2 cron in index.js.
//
// Reads recent run activity from the webhook collector (StatusFeed) — the
// same cheap DO-RPC source as /activity, no GitHub API calls — diffs it
// against a KV cursor, and posts embeds to a channel webhook for:
//   - completed runs that failed or timed out (red), and
//   - the first success after a failure ("recovered", green).
// Healthy→healthy successes and cancelled runs stay silent so the channel
// only carries signal.
//
// Secret to provision (one-time):
//   wrangler secret put DISCORD_WEBHOOK_URL

const STATE_KEY = 'discord:notify-state';
const EMBEDS_PER_MESSAGE = 10; // Discord's per-message embed cap

const COLOR_FAILURE   = 0xda3633;
const COLOR_TIMED_OUT = 0xdb6d28;
const COLOR_RECOVERED = 0x3fb950;

// Same pattern as collect.js: community per-extension runs carry "🐤 <ext>"
// in their display title.
const DISPLAY_TITLE_RE = /🐤\s+([\w.-]+)/;

// Failure/recovery pairing key. Community-extension runs key on the
// extension (so chess recovering doesn't clear h3's failure); everything
// else keys on the repo. Repo-level keying can mispair across workflows in
// the same repo, but RunActivity doesn't carry the workflow path and the
// fired repos are effectively one-workflow-per-concern.
function recoveryKey(run) {
  const m = run.title ? run.title.match(DISPLAY_TITLE_RE) : null;
  return m ? `${run.repo}#${m[1]}` : String(run.repo || 'unknown');
}

function shortRepo(repo) {
  const parts = String(repo || '').split('/');
  return parts[parts.length - 1] || String(repo || 'unknown');
}

function truncate(s, n) {
  s = String(s ?? '');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function fmtDuration(sec) {
  if (sec == null || !Number.isFinite(sec)) return null;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function embedTitle(icon, run) {
  const num = run.runNumber != null ? ` #${run.runNumber}` : '';
  return truncate(`${icon} ${shortRepo(run.repo)}${num} — ${run.title || 'workflow run'}`, 256);
}

function failureEmbed(run) {
  const failedJobs = (run.jobs || []).filter(j => j.conclusion === 'failure' || j.conclusion === 'timed_out');
  const lines = failedJobs.slice(0, 5).map(j => `• ${truncate(j.name, 80)}`);
  if (failedJobs.length > 5) lines.push(`• …and ${failedJobs.length - 5} more`);
  const dur = fmtDuration(run.elapsedSec);
  if (dur) lines.push(`took ${dur}`);
  return {
    title: embedTitle('❌', run),
    url: run.url || undefined,
    description: truncate(lines.join('\n'), 2048) || undefined,
    color: run.conclusion === 'timed_out' ? COLOR_TIMED_OUT : COLOR_FAILURE,
    timestamp: run.updatedAt || undefined,
  };
}

function recoveryEmbed(run) {
  const dur = fmtDuration(run.elapsedSec);
  return {
    title: embedTitle('✅', run),
    url: run.url || undefined,
    description: `Recovered — first green run after a failure.${dur ? ` Took ${dur}.` : ''}`,
    color: COLOR_RECOVERED,
    timestamp: run.updatedAt || undefined,
  };
}

async function postWebhook(url, payload) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return;
    if (res.status === 429 && attempt === 0) {
      // Webhook rate limit (~30/min). Honor retry_after once, then give up
      // and let the next cron tick re-send (the KV cursor only advances on
      // success, so nothing is lost).
      let waitMs = 2000;
      try {
        const body = await res.json();
        if (Number.isFinite(body?.retry_after)) waitMs = Math.ceil(body.retry_after * 1000);
      } catch (_) {}
      await new Promise(r => setTimeout(r, Math.min(waitMs, 10_000)));
      continue;
    }
    throw new Error(`discord webhook ${res.status}: ${truncate(await res.text(), 200)}`);
  }
  throw new Error('discord webhook: still rate-limited after retry');
}

async function sendEmbeds(url, embeds) {
  for (let i = 0; i < embeds.length; i += EMBEDS_PER_MESSAGE) {
    await postWebhook(url, {
      username: 'haybarn status',
      embeds: embeds.slice(i, i + EMBEDS_PER_MESSAGE),
    });
  }
}

export async function notifyDiscord(env) {
  if (!env.DISCORD_WEBHOOK_URL) {
    console.log('discord notify: DISCORD_WEBHOOK_URL not set, skipping');
    return;
  }

  let runs;
  try {
    runs = await Promise.race([
      env.FEED.recentRunActivity(100),
      new Promise((_, rej) => setTimeout(() => rej(new Error('feed RPC timed out after 10s')), 10_000)),
    ]);
  } catch (e) {
    console.log('discord notify: feed read failed:', e?.message || e);
    throw e;
  }
  if (!Array.isArray(runs) || !runs.length) {
    console.log(`discord notify: feed returned ${Array.isArray(runs) ? 'empty list' : typeof runs}, nothing to do`);
    return;
  }
  const newest = Math.max(...runs.map(r => r.receivedAt || 0));

  const state = await env.STATUS_KV.get(STATE_KEY, { type: 'json' });
  if (!state || typeof state.cursor !== 'number') {
    // First tick ever: baseline the cursor silently instead of replaying
    // history into the channel.
    await env.STATUS_KV.put(STATE_KEY, JSON.stringify({ cursor: newest, failing: {} }));
    console.log('discord notify: baselined cursor, no messages sent');
    return;
  }

  // A run's receivedAt is the timestamp of its latest webhook event, so a
  // completion always bumps it past the cursor — in-progress runs we skipped
  // on earlier ticks still get picked up the tick after they finish.
  const failing = state.failing || {};
  const fresh = runs
    .filter(r => r.status === 'completed' && (r.receivedAt || 0) > state.cursor)
    .sort((a, b) => (a.receivedAt || 0) - (b.receivedAt || 0));

  const embeds = [];
  for (const run of fresh) {
    const key = recoveryKey(run);
    if (run.conclusion === 'failure' || run.conclusion === 'timed_out') {
      embeds.push(failureEmbed(run));
      failing[key] = run.conclusion;
    } else if (run.conclusion === 'success' && failing[key]) {
      embeds.push(recoveryEmbed(run));
      delete failing[key];
    }
  }

  if (embeds.length) await sendEmbeds(env.DISCORD_WEBHOOK_URL, embeds);

  // Advance the cursor only after every send succeeded: a webhook outage
  // means a duplicate next tick rather than a silently dropped alert.
  await env.STATUS_KV.put(STATE_KEY, JSON.stringify({ cursor: newest, failing }));
  if (embeds.length) console.log(`discord notify: sent ${embeds.length} embed(s)`);
}
