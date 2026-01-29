import { GoogleGenAI } from "@google/genai";
import { ChatMessage, SearchResult } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const performResearch = async (query: string): Promise<ChatMessage> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "Sem resultados.";
    
    // Extract grounding chunks for citations
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: SearchResult[] = chunks
      .map((chunk) => {
        if (chunk.web?.uri && chunk.web?.title) {
          return {
            title: chunk.web.title,
            uri: chunk.web.uri,
          };
        }
        return null;
      })
      .filter((s): s is SearchResult => s !== null);

    // Remove duplicates
    const uniqueSources = sources.filter((v, i, a) => a.findIndex(t => (t.uri === v.uri)) === i);

    return {
      role: 'model',
      text,
      sources: uniqueSources,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Research error:", error);
    return {
      role: 'model',
      text: "Erro ao acessar os bancos de dados da Aura. Verifique a chave de API ou a conexão.",
      timestamp: Date.now(),
    };
  }
};