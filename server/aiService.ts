import OpenAI from "openai";
import type { AIExtractionResult } from "@shared/schema";
import * as pdfParse from "pdf-parse";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SHARED_CLASSIFICATION_RULES = `
Type rules (CRITICAL — read carefully):
- type = "income"  when the document is an invoice or quote YOU issued TO a customer, a payment received from a customer, or money coming INTO the business.
- type = "expense" when the document is a supplier invoice, receipt for something you purchased, or money going OUT of the business.
  Key signal: if the vendor/customer field names a CLIENT or CUSTOMER you are billing, choose "income". If it names a SUPPLIER you paid, choose "expense".

Tax code rules:
- "standard"    — normal VAT at 15% (default for most South African transactions)
- "zero_rated"  — explicitly stated as zero-rated (e.g. exports, basic foods, international services)
- "exempt"      — medical, educational, financial services that are VAT-exempt
- "out_of_scope" — capital contributions, director loans, SARS payments, transfers between own accounts
`;

export async function extractFromImage(base64Image: string): Promise<AIExtractionResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting financial data from receipt and invoice images.
Analyze the image and extract: vendor name, amount, date, description, most appropriate category, transaction type, and VAT tax code.
Categories: Meals & Entertainment, Office Supplies, Payroll, Professional Services, Travel, Utilities, Other.
${SHARED_CLASSIFICATION_RULES}
Respond with JSON in this exact format: {
  "vendor": "string",
  "amount": "number as string (e.g., '45.50')",
  "date": "YYYY-MM-DD format",
  "description": "brief description",
  "category": "one of the categories listed above",
  "confidence": "float between 0 and 1",
  "type": "expense or income",
  "taxCode": "standard, zero_rated, exempt, or out_of_scope"
}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the financial information from this receipt/invoice image."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      vendor: result.vendor || "Unknown Vendor",
      amount: result.amount || "0.00",
      date: result.date || new Date().toISOString().split('T')[0],
      description: result.description || "",
      category: result.category || "Other",
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
      type: result.type === "income" ? "income" : "expense",
      taxCode: ["standard", "zero_rated", "exempt", "out_of_scope"].includes(result.taxCode)
        ? result.taxCode
        : "standard",
    };
  } catch (error) {
    console.error("Error extracting from image:", error);
    throw new Error("Failed to extract data from image");
  }
}

export async function extractFromNaturalLanguage(text: string): Promise<AIExtractionResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an expert at parsing natural language descriptions of financial transactions.
Extract: vendor name, amount, date (default to today if not specified), description, most appropriate category, transaction type, and VAT tax code.
Categories: Meals & Entertainment, Office Supplies, Payroll, Professional Services, Travel, Utilities, Other.
${SHARED_CLASSIFICATION_RULES}
Respond with JSON in this exact format: {
  "vendor": "string",
  "amount": "number as string (e.g., '45.50')",
  "date": "YYYY-MM-DD format",
  "description": "brief description",
  "category": "one of the categories listed above",
  "confidence": "float between 0 and 1",
  "type": "expense or income",
  "taxCode": "standard, zero_rated, exempt, or out_of_scope"
}
Today's date is ${new Date().toISOString().split('T')[0]}.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      vendor: result.vendor || "Unknown Vendor",
      amount: result.amount || "0.00",
      date: result.date || new Date().toISOString().split('T')[0],
      description: result.description || text,
      category: result.category || "Other",
      confidence: Math.max(0, Math.min(1, result.confidence || 0.7)),
      type: result.type === "income" ? "income" : "expense",
      taxCode: ["standard", "zero_rated", "exempt", "out_of_scope"].includes(result.taxCode)
        ? result.taxCode
        : "standard",
    };
  } catch (error) {
    console.error("Error extracting from natural language:", error);
    throw new Error("Failed to parse natural language input");
  }
}

export async function extractFromPDF(pdfBuffer: Buffer): Promise<AIExtractionResult> {
  try {
    // Parse PDF to extract text
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text;

    // Use OpenAI to analyze the extracted text
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting financial data from PDF invoice and receipt text.
Analyze the text and extract: vendor name, total amount, date, description, most appropriate category, transaction type, and VAT tax code.
Categories: Meals & Entertainment, Office Supplies, Payroll, Professional Services, Travel, Utilities, Other.
${SHARED_CLASSIFICATION_RULES}
Respond with JSON in this exact format: {
  "vendor": "string",
  "amount": "number as string (e.g., '45.50')",
  "date": "YYYY-MM-DD format",
  "description": "brief description",
  "category": "one of the categories listed above",
  "confidence": "float between 0 and 1",
  "type": "expense or income",
  "taxCode": "standard, zero_rated, exempt, or out_of_scope"
}`,
        },
        {
          role: "user",
          content: `Extract financial information from this PDF text:\n\n${pdfText}`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      vendor: result.vendor || "Unknown Vendor",
      amount: result.amount || "0.00",
      date: result.date || new Date().toISOString().split('T')[0],
      description: result.description || "",
      category: result.category || "Other",
      confidence: Math.max(0, Math.min(1, result.confidence || 0.6)),
      type: result.type === "income" ? "income" : "expense",
      taxCode: ["standard", "zero_rated", "exempt", "out_of_scope"].includes(result.taxCode)
        ? result.taxCode
        : "standard",
    };
  } catch (error) {
    console.error("Error extracting from PDF:", error);
    throw new Error("Failed to extract data from PDF");
  }
}
