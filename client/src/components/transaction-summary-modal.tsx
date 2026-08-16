import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Receipt,
  Sparkles,
  ShieldCheck,
  CircleMinus,
} from "lucide-react";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NlpClassification {
  kind: string;
  direction: string;
  affectsProfit: boolean;
  taxCode: string;
  confidence: number;
  reason?: string;
  source?: "rules" | "llm" | "fallback";
}

interface SavedTransaction {
  id: number;
  vendor: string;
  amount: string;
  date: string;
  type: string;
  kind: string;
  direction: string;
  affectsProfit: boolean;
  taxCode: string;
  taxRate?: number;
  taxInclusive?: boolean;
  aiConfidence?: number;
  description?: string;
  _nlpClassification?: NlpClassification;
}

interface TransactionSummaryModalProps {
  open: boolean;
  onClose: () => void;
  transaction: SavedTransaction | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAmount(raw: string) {
  const n = parseFloat(raw);
  return isNaN(n) ? raw : `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

function formatDate(raw: string) {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

const KIND_LABELS: Record<string, { label: string; explanation: string }> = {
  expense:    { label: "Expense",              explanation: "Day-to-day business cost — included in profit calculation." },
  income:     { label: "Income",               explanation: "Business revenue — included in profit calculation." },
  capital:    { label: "Capital contribution", explanation: "Owner equity injection — excluded from P&L (not revenue)." },
  owner_loan: { label: "Director's loan",      explanation: "Financing from the owner — excluded from P&L (not revenue)." },
  transfer:   { label: "Internal transfer",    explanation: "Movement between own accounts — excluded from P&L." },
  tax:        { label: "SARS payment",         explanation: "Tax remittance — excluded from P&L (not an operating expense)." },
};

const TAX_CODE_LABELS: Record<string, { label: string; detail: string }> = {
  standard:    { label: "Standard (15%)",  detail: "Included in VAT201 at 15%." },
  zero_rated:  { label: "Zero-rated (0%)", detail: "Included in VAT201 at 0%." },
  exempt:      { label: "Exempt",          detail: "Exempt supply — excluded from VAT201." },
  out_of_scope:{ label: "Out of scope",    detail: "Not subject to VAT — excluded from VAT201." },
};

const SOURCE_LABELS: Record<string, string> = {
  rules:    "Rule-based classifier (instant, no API call)",
  llm:      "AI classifier (GPT-4o-mini)",
  fallback: "Fallback defaults (LLM timed out)",
};

function confidenceLabel(c: number) {
  if (c >= 0.9) return { text: "High confidence", variant: "default" as const };
  if (c >= 0.7) return { text: "Medium confidence", variant: "secondary" as const };
  return { text: "Low confidence — review recommended", variant: "destructive" as const };
}

// ─── Row component ────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground shrink-0 w-32">{label}</span>
      <span className="text-sm text-right flex-1">{children}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TransactionSummaryModal({ open, onClose, transaction }: TransactionSummaryModalProps) {
  const [, navigate] = useLocation();

  if (!transaction) return null;

  const nlp = transaction._nlpClassification;
  const kind = transaction.kind ?? nlp?.kind ?? "expense";
  const taxCode = transaction.taxCode ?? nlp?.taxCode ?? "standard";
  const affectsProfit = transaction.affectsProfit ?? nlp?.affectsProfit ?? true;
  const aiConf = transaction.aiConfidence ?? nlp?.confidence;

  const kindInfo  = KIND_LABELS[kind]     ?? { label: kind,    explanation: "" };
  const taxInfo   = TAX_CODE_LABELS[taxCode] ?? { label: taxCode, detail: "" };
  const isIncome  = transaction.type === "income";
  const conf      = aiConf != null ? confidenceLabel(aiConf) : null;

  function handleViewLedger() {
    onClose();
    navigate("/transactions");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="dialog-transaction-summary">

        {/* Header */}
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <DialogTitle>Transaction saved</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-5">

          {/* ── Transaction snapshot ── */}
          <div className="space-y-2">
            <Row label="Vendor">{transaction.vendor}</Row>
            <Row label="Amount">
              <span className="font-medium">{formatAmount(transaction.amount)}</span>
            </Row>
            <Row label="Date">{formatDate(transaction.date)}</Row>
            {transaction.description && (
              <Row label="Description">
                <span className="text-muted-foreground">{transaction.description}</span>
              </Row>
            )}
          </div>

          <Separator />

          {/* ── Accounting treatment ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <BarChart2 className="w-4 h-4" />
              Accounting treatment
            </div>

            {/* Type badge */}
            <div className="flex items-start gap-2">
              {isIncome
                ? <TrendingUp  className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                : <TrendingDown className="w-4 h-4 mt-0.5 text-rose-500  shrink-0" />}
              <div>
                <p className="text-sm font-medium">{kindInfo.label}</p>
                <p className="text-xs text-muted-foreground">{kindInfo.explanation}</p>
              </div>
            </div>

            {/* P&L */}
            <div className="flex items-start gap-2">
              {affectsProfit
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                : <CircleMinus  className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />}
              <div>
                <p className="text-sm font-medium">
                  {affectsProfit ? "Included in P&L" : "Excluded from P&L"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {affectsProfit
                    ? "Appears in your Income Statement and Management Accounts."
                    : "Does not affect reported profit — correct for owner funds."}
                </p>
              </div>
            </div>

            {/* VAT */}
            <div className="flex items-start gap-2">
              <Receipt className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">VAT: {taxInfo.label}</p>
                <p className="text-xs text-muted-foreground">{taxInfo.detail}</p>
              </div>
            </div>
          </div>

          {/* ── AI / classifier notes ── */}
          {(nlp || aiConf != null) && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Sparkles className="w-4 h-4" />
                  AI classification
                </div>

                {conf && (
                  <div className="flex items-center gap-2">
                    <Badge variant={conf.variant} data-testid="badge-ai-confidence">
                      {Math.round(aiConf! * 100)}% — {conf.text}
                    </Badge>
                  </div>
                )}

                {nlp?.source && (
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground">{SOURCE_LABELS[nlp.source] ?? nlp.source}</p>
                  </div>
                )}

                {nlp?.reason && (
                  <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
                    {nlp.reason}
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── Actions ── */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} data-testid="button-summary-done">
              Done
            </Button>
            <Button className="flex-1" onClick={handleViewLedger} data-testid="button-summary-view-ledger">
              View in Ledger
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
