/**
 * LLM Classifier Evaluation Test
 *
 * Runs all 60 labelled fixtures from classifier-labels.json through the full
 * classifyFromNLP() pipeline (Stage 1 rules + Stage 2 LLM fallback) and checks:
 *
 *   - HARD:  `kind` must match expected — counted towards accuracy threshold
 *   - SOFT:  `direction` and `affects_profit` mismatches are logged as warnings
 *            but do NOT fail individual assertions
 *
 * The single pass/fail gate is: accuracy >= 85% across all 60 fixtures.
 *
 * Named *.fuzz.test.ts so it runs with `npm run test:agent:fuzz` (slow suite)
 * and therefore with `npm run test:agent:all`, while staying out of the fast
 * `npm run test:agent` run.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import { classifyFromNLP } from "../../nlp/classifyTransaction";

// ---------------------------------------------------------------------------
// Load fixtures
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

const fixtureFile = join(__dir, "fixtures", "classifier-labels.json");
const { fixtures } = JSON.parse(readFileSync(fixtureFile, "utf-8")) as {
  fixtures: Array<{
    id: number;
    text: string;
    vendor: string;
    expected: { kind: string; direction: string; affects_profit: boolean };
    route: string;
    note: string;
  }>;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FailedCase {
  id: number;
  text: string;
  expected: string;
  got: string;
  source: string;
}

interface SoftWarning {
  id: number;
  field: string;
  expected: string | boolean;
  got: string | boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACCURACY_THRESHOLD = 0.85;
const CONCURRENCY = 10; // parallel OpenAI calls per batch

async function runBatch(
  batch: (typeof fixtures)[number][]
): Promise<{ passed: number[]; failed: FailedCase[]; warnings: SoftWarning[] }> {
  const results = await Promise.all(
    batch.map(async (fixture) => {
      const result = await classifyFromNLP({
        text: fixture.text,
        vendor: fixture.vendor || "",
        currentUserName: "Test Owner",
      });

      const kindMatch = result.kind === fixture.expected.kind;
      const warnings: SoftWarning[] = [];

      if (result.direction !== fixture.expected.direction) {
        warnings.push({
          id: fixture.id,
          field: "direction",
          expected: fixture.expected.direction,
          got: result.direction,
        });
      }

      if (result.affectsProfit !== fixture.expected.affects_profit) {
        warnings.push({
          id: fixture.id,
          field: "affects_profit",
          expected: fixture.expected.affects_profit,
          got: result.affectsProfit,
        });
      }

      return {
        id: fixture.id,
        text: fixture.text,
        kindMatch,
        expected: fixture.expected.kind,
        got: result.kind,
        source: result.source ?? "unknown",
        warnings,
      };
    })
  );

  const passed: number[] = [];
  const failed: FailedCase[] = [];
  const warnings: SoftWarning[] = [];

  for (const r of results) {
    if (r.kindMatch) {
      passed.push(r.id);
    } else {
      failed.push({
        id: r.id,
        text: r.text.substring(0, 70),
        expected: r.expected,
        got: r.got,
        source: r.source,
      });
    }
    warnings.push(...r.warnings);
  }

  return { passed, failed, warnings };
}

// ---------------------------------------------------------------------------
// Eval test
// ---------------------------------------------------------------------------

describe("LLM Classifier Eval (60-fixture labelled dataset)", () => {
  test(
    `classifies ≥ ${Math.round(ACCURACY_THRESHOLD * 100)}% of 60 labelled transactions correctly (kind)`,
    async () => {
      const allPassed: number[] = [];
      const allFailed: FailedCase[] = [];
      const allWarnings: SoftWarning[] = [];

      // Process in batches to parallelise without flooding the API
      for (let i = 0; i < fixtures.length; i += CONCURRENCY) {
        const batch = fixtures.slice(i, i + CONCURRENCY);
        const { passed, failed, warnings } = await runBatch(batch);
        allPassed.push(...passed);
        allFailed.push(...failed);
        allWarnings.push(...warnings);
      }

      const total = fixtures.length;
      const passCount = allPassed.length;
      const failCount = allFailed.length;
      const accuracy = passCount / total;

      // ------------------------------------------------------------------
      // Print results
      // ------------------------------------------------------------------

      console.log("\n╔══════════════════════════════════════════════════════╗");
      console.log(  "║        LLM CLASSIFIER EVAL — RESULTS                ║");
      console.log(  "╚══════════════════════════════════════════════════════╝");
      console.log(`  Total fixtures : ${total}`);
      console.log(`  Passed (kind)  : ${passCount}`);
      console.log(`  Failed (kind)  : ${failCount}`);
      console.log(`  Accuracy       : ${(accuracy * 100).toFixed(1)}%  (threshold: ${Math.round(ACCURACY_THRESHOLD * 100)}%)`);

      if (allFailed.length > 0) {
        console.log("\n  ── Kind mismatches (hard failures) ──────────────────");
        console.table(
          allFailed.map((f) => ({
            id: f.id,
            expected: f.expected,
            got: f.got,
            source: f.source,
            text: f.text,
          }))
        );
      }

      if (allWarnings.length > 0) {
        console.log("\n  ── Soft warnings (direction / affects_profit) ───────");
        console.table(
          allWarnings.map((w) => ({
            id: w.id,
            field: w.field,
            expected: String(w.expected),
            got: String(w.got),
          }))
        );
      } else {
        console.log("\n  No soft warnings — direction and affects_profit all match.");
      }

      console.log("");

      // ------------------------------------------------------------------
      // Single hard assertion: accuracy threshold
      // ------------------------------------------------------------------
      expect(
        accuracy,
        `Classifier accuracy ${(accuracy * 100).toFixed(1)}% is below the required ${Math.round(ACCURACY_THRESHOLD * 100)}% threshold.\n` +
          `Failed fixtures: ${allFailed.map((f) => `#${f.id} (expected=${f.expected} got=${f.got})`).join(", ")}`
      ).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);
    },
    180_000 // 3-minute timeout for 60 LLM calls
  );
});
