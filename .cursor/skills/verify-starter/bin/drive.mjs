/**
 * Drive the running app in headless Chromium and record evidence per step.
 *
 *   node .cursor/skills/verify-starter/bin/drive.mjs --feature <id> [flags] <step>...
 *
 * Flags:
 *   --feature <id>          evidence goes to <ARTIFACTS_DIR>/<id>/ (required)
 *   --base <url>            app URL; default BASE_URL from the launch state
 *   --continue              keep going after a failed step (default: stop)
 *   --clerk-testing-token   clerkSetup() + setupClerkTestingToken(); needs
 *                           CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY
 *   --sign-in <email>       after the first goto, clerk.signIn() that user
 *                           (needs --clerk-testing-token and an existing
 *                           Clerk dev-instance user)
 *
 * Each step is one shell argument. Quotes inside a step group words:
 *   'click role=button name="Populate posts"'
 *
 * Steps:
 *   goto <path>                       navigate; records the HTTP status
 *   wait-convex                       wait until the page opened its Convex
 *                                     WebSocket (client hydrated, queries live)
 *   wait-idle                         wait for network idle
 *   click <locator>                   click
 *   fill <locator> <value>            fill an input
 *   press <key>                       keyboard press on the page
 *   expect <locator> [state]          state: visible (default), hidden,
 *                                     enabled, disabled, count=N, min=N
 *   expect-text <text>                text visible anywhere on the page
 *   expect-url <regex>                current URL matches
 *   expect-status <code>              status of the last goto
 *   screenshot <name>                 full-page PNG
 *   aria <name>                       ARIA snapshot of <body> to .aria.txt
 *   sleep <ms>                        last resort; prefer expect/wait-*
 *   note <text>                       free text into steps.jsonl
 *
 * Locator tokens (combine as needed):
 *   role=<role> name=<name> [exact]   getByRole
 *   text=<text> [exact]               getByText
 *   label=<text>                      getByLabel
 *   placeholder=<text>                getByPlaceholder
 *   css=<selector>                    locator(selector)
 *   within=<css> [within-text=<t>]    scope inside a container first
 *   first | nth=<n>                   pick one match
 *
 * Evidence written to <ARTIFACTS_DIR>/<feature>/: steps.jsonl (one line per
 * step: action, result, timing, screenshot), NN-<verb>.png after every step,
 * console.log (browser console + page errors), *.aria.txt, summary.json.
 * Exit code 0 when every step passed, 1 otherwise.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const VERIFY_HOME = process.env.VERIFY_HOME ?? '/tmp/verify-starter';
const STATE_FILE = join(VERIFY_HOME, 'run', 'state.env');
const STEP_TIMEOUT_MS = 20_000;

/** Write a line to stdout. */
function out(line) {
  process.stdout.write(`${line}\n`);
}

/** Write a line to stderr. */
function err(line) {
  process.stderr.write(`${line}\n`);
}

/**
 * Parse KEY=VALUE lines.
 *
 * @param {{ text: string }} params
 * @returns {{ values: Record<string, string> }}
 */
function parseEnvText({ text }) {
  const values = {};
  for (const line of text.split('\n')) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) {
      values[match[1]] = match[2];
    }
  }
  return { values };
}

/**
 * Split one step string into words, honoring single and double quotes.
 *
 * @param {{ step: string }} params
 * @returns {{ words: string[] }}
 */
function tokenize({ step }) {
  const words = [];
  let current = '';
  let quote = null;
  let hasWord = false;
  for (const ch of step) {
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      hasWord = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (hasWord) {
        words.push(current);
        current = '';
        hasWord = false;
      }
      continue;
    }
    current += ch;
    hasWord = true;
  }
  if (quote) {
    throw new Error(`unterminated quote in step: ${step}`);
  }
  if (hasWord) {
    words.push(current);
  }
  return { words };
}

/**
 * Build a Playwright locator from `key=value` tokens. Consumes tokens until
 * one that is not a locator token; returns the rest.
 *
 * @param {{ page: import('@playwright/test').Page, tokens: string[] }} params
 * @returns {{ locator: import('@playwright/test').Locator, rest: string[], label: string }}
 */
function buildLocator({ page, tokens }) {
  const opts = {};
  const used = [];
  let index = 0;
  for (; index < tokens.length; index++) {
    const token = tokens[index];
    const eq = token.indexOf('=');
    if (token === 'exact' || token === 'first') {
      opts[token] = true;
      used.push(token);
      continue;
    }
    if (eq === -1) {
      break;
    }
    const key = token.slice(0, eq);
    const value = token.slice(eq + 1);
    if (
      ![
        'role',
        'name',
        'text',
        'label',
        'placeholder',
        'css',
        'within',
        'within-text',
        'nth',
      ].includes(key)
    ) {
      break;
    }
    opts[key] = value;
    used.push(token);
  }
  let scope = page;
  if (opts.within) {
    scope = page.locator(
      opts.within,
      opts['within-text'] ? { hasText: opts['within-text'] } : undefined,
    );
  }
  let locator;
  if (opts.role) {
    locator = scope.getByRole(opts.role, {
      ...(opts.name !== undefined ? { name: opts.name } : {}),
      ...(opts.exact ? { exact: true } : {}),
    });
  } else if (opts.text !== undefined) {
    locator = scope.getByText(opts.text, opts.exact ? { exact: true } : {});
  } else if (opts.label !== undefined) {
    locator = scope.getByLabel(opts.label);
  } else if (opts.placeholder !== undefined) {
    locator = scope.getByPlaceholder(opts.placeholder);
  } else if (opts.css !== undefined) {
    locator = scope.locator(opts.css);
  } else if (opts.within) {
    locator = scope;
  } else {
    throw new Error(`no locator in: ${tokens.join(' ')}`);
  }
  if (opts.first) {
    locator = locator.first();
  } else if (opts.nth !== undefined) {
    locator = locator.nth(Number(opts.nth));
  }
  return { locator, rest: tokens.slice(index), label: used.join(' ') };
}

/**
 * Parse argv into flags and steps.
 *
 * @param {{ argv: string[] }} params
 * @returns {{ flags: Record<string, string | boolean>, steps: string[] }}
 */
function parseArgs({ argv }) {
  const flags = {};
  const steps = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--feature' || arg === '--base' || arg === '--sign-in') {
      flags[arg.slice(2)] = argv[++i];
    } else if (arg === '--continue' || arg === '--clerk-testing-token') {
      flags[arg.slice(2)] = true;
    } else if (arg === '-h' || arg === '--help') {
      flags.help = true;
    } else {
      steps.push(arg);
    }
  }
  return { flags, steps };
}

/**
 * Load Clerk keys the way playwright.config.ts does: shell env wins, then
 * `.env.local`, then `.env`.
 */
function loadClerkEnv() {
  for (const file of ['.env.local', '.env']) {
    const path = join(REPO_ROOT, file);
    if (existsSync(path)) {
      const { values } = parseEnvText({ text: readFileSync(path, 'utf8') });
      for (const [key, value] of Object.entries(values)) {
        if (!process.env[key] && value) {
          process.env[key] = value;
        }
      }
    }
  }
}

async function main() {
  const { flags, steps } = parseArgs({ argv: process.argv.slice(2) });
  if (flags.help || !flags.feature || steps.length === 0) {
    const doc = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    out(
      doc
        .slice(0, doc.indexOf('*/'))
        .replaceAll(/^\s*\/?\*+ ?/gm, '')
        .trim(),
    );
    process.exit(flags.help ? 0 : 2);
  }

  let state = {};
  if (existsSync(STATE_FILE)) {
    state = parseEnvText({ text: readFileSync(STATE_FILE, 'utf8') }).values;
  }
  const baseUrl = flags.base ?? state.BASE_URL;
  if (!baseUrl) {
    err(
      'drive: no --base and no launch state; run bin/launch.sh or pass --base <url>',
    );
    process.exit(2);
  }
  if (flags['sign-in'] && !flags['clerk-testing-token']) {
    err('drive: --sign-in needs --clerk-testing-token');
    process.exit(2);
  }
  if (flags['clerk-testing-token']) {
    loadClerkEnv();
    if (!process.env.CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
      err(
        'drive: --clerk-testing-token needs CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY',
      );
      process.exit(2);
    }
  }

  const artifactsDir =
    process.env.ARTIFACTS_DIR ??
    state.ARTIFACTS_DIR ??
    join(VERIFY_HOME, 'artifacts', `adhoc-${Date.now()}`);
  const featureDir = join(artifactsDir, String(flags.feature));
  mkdirSync(featureDir, { recursive: true });
  const stepsFile = join(featureDir, 'steps.jsonl');
  const consoleFile = join(featureDir, 'console.log');
  writeFileSync(stepsFile, '');
  writeFileSync(consoleFile, '');

  let clerkTesting = null;
  if (flags['clerk-testing-token']) {
    clerkTesting = await import('@clerk/testing/playwright');
    await clerkTesting.clerkSetup();
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  let convexSocketOpen = false;
  let lastStatus = null;
  page.on('console', (message) => {
    appendFileSync(consoleFile, `[${message.type()}] ${message.text()}\n`);
  });
  page.on('pageerror', (error) => {
    appendFileSync(consoleFile, `[pageerror] ${error.message}\n`);
  });
  page.on('websocket', (socket) => {
    if (/\/api\/[^/]+\/sync/.test(socket.url())) {
      convexSocketOpen = true;
      appendFileSync(
        consoleFile,
        `[websocket] convex sync opened ${socket.url()}\n`,
      );
    }
  });
  if (clerkTesting) {
    await clerkTesting.setupClerkTestingToken({ page });
  }

  const results = [];
  const startedAt = new Date().toISOString();
  let signedIn = false;
  let failed = false;

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    const { words } = tokenize({ step });
    const [verb, ...args] = words;
    const prefix = String(index + 1).padStart(2, '0');
    const started = Date.now();
    const record = { index: index + 1, step, verb, ok: false, detail: '' };
    try {
      switch (verb) {
        case 'goto': {
          const response = await page.goto(
            new URL(args[0], baseUrl).toString(),
            {
              waitUntil: 'load',
            },
          );
          lastStatus = response ? response.status() : null;
          record.detail = `status ${lastStatus} url ${page.url()}`;
          if (flags['sign-in'] && !signedIn) {
            if (!clerkTesting) {
              throw new Error('--sign-in needs --clerk-testing-token');
            }
            await clerkTesting.clerk.signIn({
              page,
              emailAddress: String(flags['sign-in']),
            });
            signedIn = true;
            record.detail += `; signed in ${flags['sign-in']}`;
          }
          break;
        }
        case 'wait-convex': {
          await expect
            .poll(() => convexSocketOpen, {
              timeout: STEP_TIMEOUT_MS,
              message: 'convex sync websocket',
            })
            .toBe(true);
          record.detail = 'convex sync websocket open';
          break;
        }
        case 'wait-idle': {
          await page.waitForLoadState('networkidle', {
            timeout: STEP_TIMEOUT_MS,
          });
          record.detail = 'network idle';
          break;
        }
        case 'click': {
          const { locator, label } = buildLocator({ page, tokens: args });
          await locator.click({ timeout: STEP_TIMEOUT_MS });
          record.detail = `clicked ${label}`;
          break;
        }
        case 'fill': {
          const { locator, rest, label } = buildLocator({ page, tokens: args });
          await locator.fill(rest.join(' '), { timeout: STEP_TIMEOUT_MS });
          record.detail = `filled ${label}`;
          break;
        }
        case 'press': {
          await page.keyboard.press(args[0]);
          record.detail = `pressed ${args[0]}`;
          break;
        }
        case 'expect': {
          const { locator, rest, label } = buildLocator({ page, tokens: args });
          const condition = rest[0] ?? 'visible';
          const options = { timeout: STEP_TIMEOUT_MS };
          if (condition === 'visible') {
            await expect(locator).toBeVisible(options);
          } else if (condition === 'hidden') {
            await expect(locator).toBeHidden(options);
          } else if (condition === 'enabled') {
            await expect(locator).toBeEnabled(options);
          } else if (condition === 'disabled') {
            await expect(locator).toBeDisabled(options);
          } else if (condition.startsWith('count=')) {
            await expect(locator).toHaveCount(
              Number(condition.slice(6)),
              options,
            );
          } else if (condition.startsWith('min=')) {
            const min = Number(condition.slice(4));
            await expect
              .poll(() => locator.count(), {
                timeout: STEP_TIMEOUT_MS,
                message: `at least ${min}`,
              })
              .toBeGreaterThanOrEqual(min);
          } else {
            throw new Error(`unknown expect condition: ${condition}`);
          }
          record.detail =
            `${label} is ${condition}` +
            (condition.startsWith('min=')
              ? ` (count ${await locator.count()})`
              : '');
          break;
        }
        case 'expect-text': {
          await expect(page.getByText(args.join(' ')).first()).toBeVisible({
            timeout: STEP_TIMEOUT_MS,
          });
          record.detail = `text visible: ${args.join(' ')}`;
          break;
        }
        case 'expect-url': {
          await expect(page).toHaveURL(new RegExp(args[0]), {
            timeout: STEP_TIMEOUT_MS,
          });
          record.detail = `url ${page.url()} matches /${args[0]}/`;
          break;
        }
        case 'expect-status': {
          if (String(lastStatus) !== args[0]) {
            throw new Error(
              `last goto status ${lastStatus}, expected ${args[0]}`,
            );
          }
          record.detail = `status ${lastStatus}`;
          break;
        }
        case 'screenshot': {
          const file = join(featureDir, `${args[0]}.png`);
          await page.screenshot({ path: file, fullPage: true });
          record.detail = file;
          break;
        }
        case 'aria': {
          const file = join(featureDir, `${args[0]}.aria.txt`);
          writeFileSync(file, await page.locator('body').ariaSnapshot());
          record.detail = file;
          break;
        }
        case 'sleep': {
          await page.waitForTimeout(Number(args[0]));
          record.detail = `slept ${args[0]}ms`;
          break;
        }
        case 'note': {
          record.detail = args.join(' ');
          break;
        }
        default:
          throw new Error(`unknown step verb: ${verb}`);
      }
      record.ok = true;
    } catch (error) {
      record.detail =
        error instanceof Error
          ? error.message.split('\n').slice(0, 3).join(' | ')
          : String(error);
      failed = true;
    }
    record.durationMs = Date.now() - started;
    const shot = join(
      featureDir,
      `${prefix}-${verb}${record.ok ? '' : '-FAILED'}.png`,
    );
    try {
      await page.screenshot({ path: shot, fullPage: true });
      record.screenshot = shot;
    } catch {
      record.screenshot = null;
    }
    record.url = page.url();
    appendFileSync(stepsFile, `${JSON.stringify(record)}\n`);
    results.push(record);
    out(`${record.ok ? 'ok  ' : 'FAIL'} ${prefix} ${step} -> ${record.detail}`);
    if (!record.ok && !flags.continue) {
      break;
    }
  }

  const summary = {
    feature: flags.feature,
    baseUrl,
    startedAt,
    finishedAt: new Date().toISOString(),
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    skipped: steps.length - results.length,
    clerkTestingToken: Boolean(clerkTesting),
    signedInAs: signedIn ? flags['sign-in'] : null,
    artifacts: featureDir,
  };
  writeFileSync(
    join(featureDir, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  await browser.close();
  out(
    `${failed ? 'FAILED' : 'PASSED'}: ${summary.passed} ok, ${summary.failed} failed, ${summary.skipped} skipped. Evidence: ${featureDir}`,
  );
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  err(
    `drive: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
  );
  process.exit(1);
});
