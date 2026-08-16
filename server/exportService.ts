import type { TransactionWithCategory } from "@shared/schema";

export function transactionsToCSV(transactions: TransactionWithCategory[]): string {
  const headers = ["Date", "Vendor", "Amount", "Category", "Type", "Description"];
  const rows = transactions.map(t => [
    new Date(t.date).toLocaleDateString('en-US'),
    escapeCSVField(t.vendor),
    Number(t.amount).toFixed(2),
    escapeCSVField(t.category?.name || ""),
    t.type,
    escapeCSVField(t.description || "")
  ]);

  const csvLines = [
    headers.join(","),
    ...rows.map(row => row.join(","))
  ];

  return csvLines.join("\n");
}

function escapeCSVField(field: string): string {
  if (!field) return "";
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
