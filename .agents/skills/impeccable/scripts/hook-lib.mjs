/**
 * Shared library for the Impeccable design hook.
 *
 * Pure-ish helpers split out from `hook.mjs` so unit tests can exercise
 * config parsing, finding filtering, dedup, render, and cache logic without
 * spawning a subprocess. `hook.mjs` itself is the thin stdin/stdout shim.
 *
 * Public surface (everything exported is part of the contract):
 *   ENVELOPE_PREFIX, ALLOWED_EXTS, ACK_EXTS, SENSITIVE_PATH, GENERATED_PATH, TRUTHY
 *   truthy(value)
 *   readConfig(cwd) / DEFAULT_CONFIG / getConfigPath(cwd) / getLocalConfigPath(cwd)
 *   resolveProjectPlatform(cwd) / isNativePlatform(platform)
 *   normalizeIgnoreValue(value)
 *   readCache(cwd) / persistCache(cwd, cache) / resolveCacheCwd(primaryFile, sessionCwd)
 *   bumpEditCount(cache, sessionId, filePath) -> number
 *   touchFile(cache, sessionId, filePath)
 *   suppressionNotice(filePath)
 *   filterFindings(findings, content, ext, config)
 *   ADVISORY_RULES / isAdvisoryFinding(finding)
 *   IMMEDIATE_TIER_RULES / splitFindingsByTier(findings) / perEditTieringActive(config, harness)
 *   matchConfiguredExtension(filePath, extensions)
 *   dedupeAgainstCache(findings, cache, sessionId, filePath)
 *   renderTemplate(findings, filePath, config, opts)
 *   renderCleanAck(filePath, opts) / renderPendingAck(filePath, known, opts)
 *   appendDesignSystemNote(text, scanOptions) / appendDesignSystemNoteOnce(text, scanOptions, cache, sessionId, config)
 *   designNoteReserve(scanOptions, cache, sessionId)
 *   footerModeForSession(cache, sessionId) / commitFooterShown(cache, sessionId, text)
 *   shouldEmitAckForFile(filePath, config?)
 *   writeAuditLog(env, entry)
 *   loadDetector() -> Promise<{ detectText, detectHtml }>
 *   matchesAnyGlob(filePath, globs)
 *   normalizeScanTargets(primaryTargets, projectCwd)
 *   runHook(deps) -> { exitCode, stdout, audit, reason? }
 *   runStopHook(deps) -> { exitCode, stdout, audit, emission? }
 *
 * Design notes:
 * - All errors are swallowed at the runHook seam. The detector throwing must
 *   never break a turn. See PRD §5 "Failure modes".
 * - Cache shape is JSON-friendly; we gc the oldest sessions when there are
 *   more than 8 to keep file size predictable across long-lived projects.
 * - The detector loader looks for `detector/detect-antipatterns.mjs` next to
 *   this file first (built skill layout) and falls back to the repo root's
 *   `cli/engine/detect-antipatterns.mjs` (running from source).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { extractPlatform, loadContext } from './context.mjs';
import { IMPECCABLE_COMMAND } from './lib/provider.mjs';
// `detector.extensions` (issue #316) is shared with Live's source search, which
// needs the same answer for `.heex` / `.blade.php` when it hunts for session
// markers. lib/template-extensions.mjs owns the shape; re-exported here because
// hook-lib has been the import site for matchConfiguredExtension since #347.
import {
  matchConfiguredExtension,
  mergeExtensions,
} from './lib/template-extensions.mjs';

export { matchConfiguredExtension };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ENVELOPE_PREFIX = '[impeccable@1]';

export const ALLOWED_EXTS = new Set([
  '.tsx', '.jsx', '.html', '.htm', '.vue', '.svelte', '.astro',
  '.css', '.scss', '.sass', '.less', '.ts', '.js',
]);

export const ACK_EXTS = new Set([
  '.tsx', '.jsx', '.html', '.htm', '.vue', '.svelte', '.astro',
  '.css', '.scss', '.sass', '.less',
]);

// Hard-skip regex for sensitive files. Cannot be turned off via config.
// Match tokenized secret/credential filenames, not UI names such as
// CredentialForm.tsx, SecretPage.jsx, or secretary-dashboard.vue.
export const SENSITIVE_PATH = new RegExp([
  String.raw`(?:^|[/\\])\.env(?:\.|$)`,
  String.raw`(?:^|[/\\])\.git(?:[/\\]|$)`,
  String.raw`(?:^|[/\\])id_rsa(?:$|[._-])[^/\\]*$`,
  String.raw`(?:^|[/\\])[^/\\]*\.pem$`,
  String.raw`(?:^|[/\\])(?:[^/\\]*[._-])?(?:secret|secrets|credential|credentials)(?=[._-])[^/\\]*\.(?:json|ya?ml|toml|ini|conf|config|env|txt|key|cert|crt|pem|js|ts)$`,
].join('|'), 'i');

// Hard-skip regex for generated, lock, minified, and build-output paths.
// `generated` is matched as a whole path segment so authored names such as
// `generated-utils.ts` or `CodeGenerator.tsx` still get scanned.
export const GENERATED_PATH = /(?:\.generated\.[a-z]+$|\.d\.ts$|\.min\.[a-z]+$|[/\\]node_modules[/\\]|[/\\]generated[/\\]|[/\\](?:dist|build|out|\.next|\.cache|coverage)[/\\]|[/\\]?[^/\\]+\.lock(?:\.json)?$)/i;

export const TRUTHY = /^(1|true|yes|on)$/i;
