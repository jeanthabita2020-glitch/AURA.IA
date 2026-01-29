import { Modality } from "@google/genai";

export enum AppMode {
  LIVE = 'LIVE',
  RESEARCH = 'RESEARCH'
}

export interface SearchResult {
  title?: string;
  uri: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  sources?: SearchResult[];
  timestamp: number;
}

export interface LiveConfig {
  model: string;
  systemInstruction: string;
  voiceName: string;
}

export interface VisualizerState {
  volume: number; // 0 to 1
  isActive: boolean;
}