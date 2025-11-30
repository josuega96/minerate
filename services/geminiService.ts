import { GoogleGenAI } from "@google/genai";

// Initialize the client. 
// NOTE: In a real production app, you might proxy this through a backend to protect the key,
// but for this client-side demo we use the env variable directly as instructed.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const enhanceObservations = async (rawText: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a geological field assistant. Rewrite the following brief field notes into a concise, professional geological observation. Fix typos and abbreviations. Keep it objective. Notes: "${rawText}"`,
    });
    
    return response.text.trim();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return rawText; // Fallback to original text on error
  }
};