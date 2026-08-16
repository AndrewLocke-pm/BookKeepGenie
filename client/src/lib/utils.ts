import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return 'R0.00';
  const abs = Math.abs(num);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return num < 0 ? `-R${formatted}` : `R${formatted}`;
}

export function formatCurrencyCompact(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return 'R0';
  const abs = Math.abs(num);
  let formatted: string;
  if (abs >= 1_000_000) {
    formatted = (abs / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  } else if (abs >= 1_000) {
    formatted = (abs / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  } else {
    formatted = abs.toFixed(0);
  }
  return num < 0 ? `-R${formatted}` : `R${formatted}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-ZA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function formatDateInput(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export function getCategoryColor(categoryName: string): string {
  const colors: Record<string, string> = {
    'Meals & Entertainment': 'hsl(var(--chart-3))',
    'Office Supplies': 'hsl(var(--chart-1))',
    'Payroll': 'hsl(var(--chart-2))',
    'Professional Services': 'hsl(var(--chart-4))',
    'Travel': 'hsl(var(--chart-5))',
    'Utilities': 'hsl(38 92% 50%)',
    'Other': 'hsl(var(--muted-foreground))',
  };
  return colors[categoryName] || colors['Other'];
}
