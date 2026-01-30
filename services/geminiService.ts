
import { GoogleGenAI } from "@google/genai";
import { Sale, Product } from "../types";

// Note: Re-instantiating on each call as per guidelines to ensure the latest API_KEY is used.
// Using 'gemini-3-pro-preview' for complex text reasoning tasks.

export async function getSalesInsights(sales: Sale[]) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-pro-preview";
  
  const salesSummary = sales.map(s => ({
    date: s.timestamp,
    total: s.total,
    items: s.items.map(i => i.name)
  }));

  const prompt = `You are a friendly, practical retail advisor helping a store owner.
Write like a human (clear, warm, not robotic), but stay concise.

Analyze this sales data and return:
- A 1-paragraph summary of performance
- 3 bullet "what to do next" actions (very specific)
- A short "watch-outs" section (1-2 bullets)

Sales data JSON:
${JSON.stringify(salesSummary)}`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.6,
        topP: 0.95,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "Unable to generate insights at this moment. Please check your connection and try again.";
  }
}

export async function getMarketIntelligence(product: Product) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-pro-preview";
  
  const prompt = `You are an experienced buyer/merchandiser helping a small business.
Write like a human: short sentences, concrete recommendations, no fluff.

Research and compare the following product in the current market:
  Product: ${product.name}
  Our Price: $${product.price}
  SKU: ${product.sku}
  Category: ${product.category}

  Please perform a Google Search to find:
  1. Current average market price for similar products.
  2. Competitive analysis (who are the top retailers selling this).
  3. Brief summary of current consumer sentiment or recent reviews.
  4. Recommendation: Should we adjust our price? Is there a rising trend?
  
Provide a concise, practical summary for a store owner.
End with a clear recommendation: "Keep price" / "Increase price" / "Reduce price" and why.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2, 
      }
    });

    const text = response.text;
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    return {
      text,
      sources: sources.map((chunk: any) => ({
        title: chunk.web?.title || 'Market Source',
        uri: chunk.web?.uri
      })).filter((s: any) => s.uri)
    };
  } catch (error) {
    console.error("Market Intelligence Error:", error);
    throw error;
  }
}
