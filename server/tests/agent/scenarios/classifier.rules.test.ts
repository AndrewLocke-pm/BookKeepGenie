import { test, expect, describe } from "vitest";
import { applyRules } from "../../../nlp/rules";
import { classifyFromNLPSync } from "../../../nlp/classifyTransaction";

describe("Classifier Rules Tests", () => {
  describe("Capital contribution detection", () => {
    test("'capital contribution' is detected as capital", () => {
      const result = applyRules({ text: "Capital contribution from owner", currentUserName: "John" });
      expect(result?.kind).toBe("capital");
    });

    test("'capital injection' is detected as capital", () => {
      const result = applyRules({ text: "Capital injection for expansion", currentUserName: "John" });
      expect(result?.kind).toBe("capital");
    });

    test("'equity injection' is detected as capital", () => {
      const result = applyRules({ text: "Equity injection from shareholders", currentUserName: "John" });
      expect(result?.kind).toBe("capital");
    });

    test("'investment into company' is detected as capital", () => {
      const result = applyRules({ text: "Investment into company", currentUserName: "John" });
      expect(result?.kind).toBe("capital");
    });
  });

  describe("Director loan detection", () => {
    test("'director loan' is detected as owner_loan", () => {
      const result = applyRules({ text: "Director loan to company", currentUserName: "John" });
      expect(result?.kind).toBe("owner_loan");
    });

    test("'shareholder loan' is detected as owner_loan", () => {
      const result = applyRules({ text: "Shareholder loan received", currentUserName: "John" });
      expect(result?.kind).toBe("owner_loan");
    });

    test("'loan to business' with director context is detected", () => {
      const result = applyRules({ text: "Director advanced loan to business", currentUserName: "John" });
      expect(result?.kind).toBe("owner_loan");
    });
  });

  describe("Negative patterns (false positives to avoid)", () => {
    test("'invest in advertising' returns null (let LLM handle)", () => {
      const result = applyRules({ text: "Invest in advertising campaign", currentUserName: "John" });
      expect(result).toBeNull();
    });

    test("'capital equipment' returns null (let LLM handle)", () => {
      const result = applyRules({ text: "Capital equipment purchase", currentUserName: "John" });
      expect(result).toBeNull();
    });

    test("'capital expenditure' returns null (let LLM handle)", () => {
      const result = applyRules({ text: "Capital expenditure for office", currentUserName: "John" });
      expect(result).toBeNull();
    });
  });

  describe("Full classifier (sync mode)", () => {
    test("'office supplies' falls back to expense", () => {
      const result = classifyFromNLPSync({ 
        text: "Office supplies from Staples", 
        currentUserName: "John" 
      });
      expect(result.kind).toBe("expense");
    });

    test("'sale revenue' falls back to income", () => {
      const result = classifyFromNLPSync({ 
        text: "Sale revenue received", 
        currentUserName: "John" 
      });
      expect(result.kind).toBe("income");
    });

    test("capital contribution enforces owner funds rules", () => {
      const result = classifyFromNLPSync({ 
        text: "Capital contribution from owner", 
        currentUserName: "John" 
      });
      expect(result.kind).toBe("capital");
      expect(result.affectsProfit).toBe(false);
      expect(result.taxCode).toBe("out_of_scope");
      expect(result.direction).toBe("inflow");
    });

    test("director loan enforces owner funds rules", () => {
      const result = classifyFromNLPSync({ 
        text: "Director loan to company", 
        currentUserName: "John" 
      });
      expect(result.kind).toBe("owner_loan");
      expect(result.affectsProfit).toBe(false);
      expect(result.taxCode).toBe("out_of_scope");
    });
  });

  describe("Tax payment detection", () => {
    test("'SARS payment' is detected as tax", () => {
      const result = applyRules({ text: "SARS tax payment", currentUserName: "John" });
      expect(result?.kind).toBe("tax");
      expect(result?.affectsProfit).toBe(false);
    });

    test("'VAT payment' is detected as tax", () => {
      const result = applyRules({ text: "VAT payment to SARS", currentUserName: "John" });
      expect(result?.kind).toBe("tax");
    });

    test("'provisional tax payment' is detected as tax", () => {
      const result = applyRules({ text: "Provisional tax payment", currentUserName: "John" });
      expect(result?.kind).toBe("tax");
    });
  });

  describe("Transfer detection", () => {
    test("'transfer between accounts' is detected as transfer", () => {
      const result = applyRules({ text: "Transfer between accounts", currentUserName: "John" });
      expect(result?.kind).toBe("transfer");
      expect(result?.affectsProfit).toBe(false);
    });

    test("'moved funds' is detected as transfer", () => {
      const result = applyRules({ text: "Moved funds to savings", currentUserName: "John" });
      expect(result?.kind).toBe("transfer");
    });
  });
});
