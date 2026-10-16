import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (aiInstance) return aiInstance;

  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.warn('[Gemini] GEMINI_API_KEY chưa được thiết lập trong biến môi trường.');
  }

  aiInstance = new GoogleGenAI({ apiKey });
  return aiInstance;
}
