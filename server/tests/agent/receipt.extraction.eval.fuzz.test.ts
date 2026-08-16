/**
 * Receipt Extraction Eval — Golden-Set Test
 *
 * Runs each of the 5 synthetic receipt images through the live
 * extractFromImage() pipeline and validates:
 *
 *   HARD  (counted towards the 80% threshold):
 *     - vendor  : case-insensitive substring match
 *     - amount  : numeric equality ±0.01
 *     - date    : YYYY-MM-DD ±1 calendar day
 *
 *   SOFT  (logged as warnings, not counted):
 *     - category : exact match against allowed categories
 *
 * Single gate: field-level accuracy (correct / total hard fields) >= 80%.
 * Named *.test.ts so it runs with `npm run test:agent` and therefore
 * `npm run test:agent:all`. 5 vision API calls takes ~15-30 s.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import { extractFromImage } from "../../aiService";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);
const FIXTURES_DIR = join(__dir, "fixtures");
const RECEIPTS_DIR = join(FIXTURES_DIR, "receipts");

// ---------------------------------------------------------------------------
// Load labels
// ---------------------------------------------------------------------------

const { receipts, _meta } = JSON.parse(
  readFileSync(join(FIXTURES_DIR, "receipt-labels.json"), "utf-8")
) as {
  _meta: { threshold: number };
  receipts: Array<{
    filename: string;
    expected: {
      vendor: string;
      amount: string;
      date: string;
      category: string;
    };
    note: string;
  }>;
};

const THRESHOLD = _meta.threshold; // 0.80

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

/** Vendor: case-insensitive substring */
function vendorMatches(got: string, expected: string): boolean {
  return got.toLowerCase().includes(expected.toLowerCase());
}

/** Amount: numeric equality ±0.01 */
function amountMatches(got: string, expected: string): boolean {
  const g = parseFloat(got);
  const e = parseFloat(expected);
  if (isNaN(g) || isNaN(e)) return false;
  return Math.abs(g - e) <= 0.01;
}

/** Date: YYYY-MM-DD, tolerance ±1 calendar day */
function dateMatches(got: string, expected: string): boolean {
  const g = new Date(got);
  const e = new Date(expected);
  if (isNaN(g.getTime()) || isNaN(e.getTime())) return false;
  const diffMs = Math.abs(g.getTime() - e.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= 1;
}

/** Category: exact match (soft check only) */
function categoryMatches(got: string, expected: string): boolean {
  return got.trim() === expected.trim();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldResult {
  receipt: string;
  field: string;
  expected: string;
  got: string;
  pass: boolean;
}

// ---------------------------------------------------------------------------
// Eval test
// ---------------------------------------------------------------------------

describe("Receipt Extraction Eval (5-image golden set)", () => {
  test(
    `extracts vendor, amount, and date with ≥ ${Math.round(THRESHOLD * 100)}% field accuracy`,
    async () => {
      const hardResults: FieldResult[] = [];
      const softWarnings: FieldResult[] = [];
      const receiptSummaries: Array<{
        filename: string;
        vendor: string;
        amount: string;
        date: string;
        category: string;
        confidence: number;
        vendorPass: boolean;
        amountPass: boolean;
        datePass: boolean;
      }> = [];

      // --- run each image through the pipeline ---
      for (const receipt of receipts) {
        const imgPath = join(RECEIPTS_DIR, receipt.filename);
        const imageBuffer = readFileSync(imgPath);
        const base64 = imageBuffer.toString("base64");

        const result = await extractFromImage(base64);

        const vPass = vendorMatches(result.vendor, receipt.expected.vendor);
        const aPass = amountMatches(result.amount, receipt.expected.amount);
        const dPass = dateMatches(result.date, receipt.expected.date);
        const cPass = categoryMatches(result.category, receipt.expected.category);

        hardResults.push(
          {
            receipt: receipt.filename,
            field: "vendor",
            expected: receipt.expected.vendor,
            got: result.vendor,
            pass: vPass,
          },
          {
            receipt: receipt.filename,
            field: "amount",
            expected: receipt.expected.amount,
            got: result.amount,
            pass: aPass,
          },
          {
            receipt: receipt.filename,
            field: "date",
            expected: receipt.expected.date,
            got: result.date,
            pass: dPass,
          }
        );

        if (!cPass) {
          softWarnings.push({
            receipt: receipt.filename,
            field: "category",
            expected: receipt.expected.category,
            got: result.category,
            pass: false,
          });
        }

        receiptSummaries.push({
          filename: receipt.filename,
          vendor: result.vendor,
          amount: result.amount,
          date: result.date,
          category: result.category,
          confidence: result.confidence,
          vendorPass: vPass,
          amountPass: aPass,
          datePass: dPass,
        });
      }

      // --- compute accuracy ---
      const totalFields = hardResults.length; // 5 receipts × 3 fields = 15
      const passedFields = hardResults.filter((r) => r.pass).length;
      const accuracy = passedFields / totalFields;

      const failedHard = hardResults.filter((r) => !r.pass);

      // --- per-field breakdown ---
      const byField: Record<string, { pass: number; total: number }> = {};
      for (const r of hardResults) {
        if (!byField[r.field]) byField[r.field] = { pass: 0, total: 0 };
        byField[r.field].total++;
        if (r.pass) byField[r.field].pass++;
      }

      // --- print results ---
      console.log("\n╔══════════════════════════════════════════════════════╗");
      console.log(  "║      RECEIPT EXTRACTION EVAL — RESULTS              ║");
      console.log(  "╚══════════════════════════════════════════════════════╝");
      console.log(`\n  Overall field accuracy : ${passedFields}/${totalFields} (${(accuracy * 100).toFixed(1)}%)  threshold: ${Math.round(THRESHOLD * 100)}%`);

      console.log("\n  ── Per-field accuracy ───────────────────────────────");
      for (const [field, stats] of Object.entries(byField)) {
        const pct = ((stats.pass / stats.total) * 100).toFixed(0);
        const bar = "█".repeat(stats.pass) + "░".repeat(stats.total - stats.pass);
        console.log(`  ${field.padEnd(8)} ${bar}  ${stats.pass}/${stats.total}  (${pct}%)`);
      }

      console.log("\n  ── Per-receipt summary ──────────────────────────────");
      console.table(
        receiptSummaries.map((r) => ({
          file: r.filename.replace("receipt_", "").replace(".png", ""),
          vendor: r.vendor,
          amount: r.amount,
          date: r.date,
          conf: r.confidence.toFixed(2),
          "V✓": r.vendorPass ? "✓" : "✗",
          "A✓": r.amountPass ? "✓" : "✗",
          "D✓": r.datePass ? "✓" : "✗",
        }))
      );

      if (failedHard.length > 0) {
        console.log("\n  ── Hard field failures ──────────────────────────────");
        console.table(
          failedHard.map((f) => ({
            receipt: f.receipt.replace("receipt_", "").replace(".png", ""),
            field: f.field,
            expected: f.expected,
            got: f.got,
          }))
        );
      }

      if (softWarnings.length > 0) {
        console.log("\n  ── Soft warnings (category) ─────────────────────────");
        console.table(
          softWarnings.map((w) => ({
            receipt: w.receipt.replace("receipt_", "").replace(".png", ""),
            expected: w.expected,
            got: w.got,
          }))
        );
      }

      console.log("");

      // --- single hard assertion ---
      expect(
        accuracy,
        `Field accuracy ${(accuracy * 100).toFixed(1)}% is below the required ${Math.round(THRESHOLD * 100)}% threshold.\n` +
          `Failed: ${failedHard.map((f) => `${f.receipt}:${f.field} (expected=${f.expected} got=${f.got})`).join("; ")}`
      ).toBeGreaterThanOrEqual(THRESHOLD);
    },
    120_000 // 2-minute timeout for 5 vision API calls
  );
});
