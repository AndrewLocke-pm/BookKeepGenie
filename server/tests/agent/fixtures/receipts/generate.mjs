/**
 * Generates 5 synthetic South African receipt PNG images for the eval dataset.
 * Run once: node server/tests/agent/fixtures/receipts/generate.mjs
 */

import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dir, { recursive: true });

function drawReceipt(spec) {
  const W = 420;
  const PAD = 24;
  const LINE = 22;

  // --- measure height first pass ---
  let rows = 0;
  rows += 4; // store name (big) + tagline + address + phone
  rows += 1; // spacer
  rows += 1; // "TAX INVOICE" header
  rows += 1; // receipt no + date
  rows += 1; // spacer
  rows += 1; // items header
  rows += spec.items.length;
  rows += 1; // divider
  rows += 1; // subtotal
  rows += 1; // vat
  rows += 1; // total (big)
  rows += 1; // spacer
  rows += 1; // vat reg + payment method
  rows += 1; // thank you
  rows += 2; // bottom padding

  const H = PAD * 2 + rows * LINE + 30;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  let y = PAD + LINE;

  const center = (text, fontSize, bold = false) => {
    ctx.font = `${bold ? "bold " : ""}${fontSize}px monospace`;
    ctx.fillStyle = "#111111";
    ctx.textAlign = "center";
    ctx.fillText(text, W / 2, y);
    y += LINE;
  };

  const left = (text, fontSize = 13) => {
    ctx.font = `${fontSize}px monospace`;
    ctx.fillStyle = "#111111";
    ctx.textAlign = "left";
    ctx.fillText(text, PAD, y);
    y += LINE;
  };

  const row = (label, value, fontSize = 13) => {
    ctx.font = `${fontSize}px monospace`;
    ctx.fillStyle = "#111111";
    ctx.textAlign = "left";
    ctx.fillText(label, PAD, y);
    ctx.textAlign = "right";
    ctx.fillText(value, W - PAD, y);
    y += LINE;
  };

  const divider = (char = "-") => {
    ctx.font = "13px monospace";
    ctx.fillStyle = "#444444";
    ctx.textAlign = "center";
    ctx.fillText(char.repeat(Math.floor((W - PAD * 2) / 8)), W / 2, y);
    y += LINE;
  };

  const spacer = () => { y += LINE * 0.5; };

  // --- header ---
  center(spec.vendor, 18, true);
  if (spec.tagline) center(spec.tagline, 12);
  center(spec.address, 12);
  center(spec.phone, 12);
  spacer();
  divider("=");
  center("TAX INVOICE", 14, true);
  row(`Receipt: ${spec.receiptNo}`, `Date: ${spec.date}`, 12);
  divider();

  // --- items ---
  row("ITEM", "AMOUNT", 12);
  divider();
  for (const item of spec.items) {
    row(item.name, `R ${item.price.toFixed(2)}`, 13);
  }
  divider();

  // --- totals ---
  const subtotal = spec.items.reduce((s, i) => s + i.price, 0);
  const vatAmount = subtotal - subtotal / 1.15;
  row("Subtotal (excl. VAT)", `R ${(subtotal - vatAmount).toFixed(2)}`, 13);
  row("VAT (15%)", `R ${vatAmount.toFixed(2)}`, 13);
  divider("=");

  ctx.font = "bold 15px monospace";
  ctx.fillStyle = "#000000";
  ctx.textAlign = "left";
  ctx.fillText("TOTAL", PAD, y);
  ctx.textAlign = "right";
  ctx.fillText(`R ${subtotal.toFixed(2)}`, W - PAD, y);
  y += LINE;

  divider("=");
  spacer();
  row("VAT Reg:", spec.vatReg, 11);
  row("Payment:", spec.payment, 11);
  spacer();
  center("Thank you for your business!", 12);
  center("www." + spec.vendor.toLowerCase().replace(/\s+/g, "") + ".co.za", 11);

  return canvas.toBuffer("image/png");
}

const receipts = [
  {
    filename: "receipt_woolworths_food.png",
    spec: {
      vendor: "Woolworths Food",
      tagline: "Quality Food. Worth It.",
      address: "Shop 12, Sandton City, Johannesburg",
      phone: "Tel: 011 783 4400",
      receiptNo: "WW-2025-031501",
      date: "2025-03-15",
      vatReg: "4150222843",
      payment: "Visa **** 4821",
      items: [
        { name: "Free Range Chicken Breast", price: 89.99 },
        { name: "Organic Salad Mix 200g",    price: 34.99 },
        { name: "Sourdough Bread Loaf",       price: 39.99 },
        { name: "Orange Juice 1L",            price: 29.99 },
        { name: "Dark Chocolate 100g",        price: 34.99 },
        { name: "Sparkling Water 6pk",        price: 15.55 },
      ],
    },
  },
  {
    filename: "receipt_incredible_connection.png",
    spec: {
      vendor: "Incredible Connection",
      tagline: "Technology for Everyone",
      address: "Clearwater Mall, Strubens Valley",
      phone: "Tel: 011 475 2900",
      receiptNo: "IC-2025-040201",
      date: "2025-04-02",
      vatReg: "4100123456",
      payment: "EFT Payment",
      items: [
        { name: "Logitech Wireless Keyboard", price: 599.00 },
        { name: "USB-C Hub 7-in-1",           price: 449.00 },
        { name: "Screen Cleaning Kit",         price: 89.00 },
        { name: "Extended Warranty 1yr",       price: 162.00 },
      ],
    },
  },
  {
    filename: "receipt_shell_garage.png",
    spec: {
      vendor: "Shell Garage",
      tagline: "You can be sure of Shell",
      address: "N1 Northbound, Midrand",
      phone: "Tel: 011 315 7800",
      receiptNo: "SH-2025-032801",
      date: "2025-03-28",
      vatReg: "4090887766",
      payment: "Nedbank Cheque *5543",
      items: [
        { name: "Unleaded 95 (42.3L @ R23.17)", price: 779.99 },
        { name: "Engine Oil Top-Up 500ml",        price: 49.99 },
        { name: "Car Wash Basic",                 price: 20.02 },
      ],
    },
  },
  {
    filename: "receipt_vodacom.png",
    spec: {
      vendor: "Vodacom",
      tagline: "Together We Can",
      address: "Vodacom World, Midrand",
      phone: "Tel: 082 111",
      receiptNo: "VC-2025-022801",
      date: "2025-02-28",
      vatReg: "4660120009",
      payment: "Monthly Debit Order",
      items: [
        { name: "Business Data Bundle 10GB",  price: 199.00 },
        { name: "Voice Minutes Bundle 200",   price: 99.00 },
        { name: "SMS Bundle 100",             price: 29.00 },
        { name: "Roaming Insurance Addon",    price: 72.00 },
      ],
    },
  },
  {
    filename: "receipt_smith_associates.png",
    spec: {
      vendor: "Smith & Associates",
      tagline: "Attorneys & Notaries",
      address: "15 Fredman Drive, Sandton, 2196",
      phone: "Tel: 011 884 7700",
      receiptNo: "SA-2025-041001",
      date: "2025-04-10",
      vatReg: "4530298110",
      payment: "EFT Received",
      items: [
        { name: "Contract Drafting (3hrs)",    price: 2700.00 },
        { name: "Legal Review & Advice",       price: 1200.00 },
        { name: "Admin & Disbursements",       price: 600.00 },
      ],
    },
  },
];

for (const { filename, spec } of receipts) {
  const png = drawReceipt(spec);
  const outPath = join(__dir, filename);
  writeFileSync(outPath, png);
  const total = spec.items.reduce((s, i) => s + i.price, 0);
  console.log(`✓  ${filename}  (total R${total.toFixed(2)}, date ${spec.date})`);
}

console.log("\nAll 5 receipt images generated.");
