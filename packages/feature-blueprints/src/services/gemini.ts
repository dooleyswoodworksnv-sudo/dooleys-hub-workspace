export interface BlueprintItem {
  id: string;
  type: "room" | "dimension" | "door_schedule" | "window_schedule" | "general_note" | "other";
  label: string;
  description?: string;
  value?: string;
  page?: number;
  boundingBox: {
    xMin: number; // percentage 0-100
    yMin: number; // percentage 0-100
    xMax: number; // percentage 0-100
    yMax: number; // percentage 0-100
  };
  confidence: number;
}

export interface BlueprintData {
  analysisSummary: string;
  items: BlueprintItem[];
}

export interface Notation {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text: string;
  page?: number;
  manualDimensions?: {
    length?: string;
    width?: string;
    height?: string;
  };
}

export interface Guide {
  id: string;
  type?: 'length' | 'area' | 'angle';
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  points?: { x: number; y: number }[];
  label: string;
  page?: number;
}

export interface CalibrationData {
  pixels: number;
  realWorld: number;
  unit: string;
}

import { GoogleGenAI, Type } from '@google/genai';
import {
  type BlueprintType,
  getSystemInstruction,
  getPrompt,
  getExplainPrompt,
} from './prompts';

function getAiClient() {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    throw new Error('API Key not found. Please enter your Gemini API Key in the settings.');
  }
  return new GoogleGenAI({ apiKey });
}

export async function analyzeBlueprint(
  fileData: string, 
  mimeType: string, 
  userPrompt?: string,
  blueprintType?: BlueprintType
): Promise<BlueprintData> {
  const ai = getAiClient();
  const base64Data = fileData.split(',')[1];
  
  // Build the analysis prompt from the template system
  const selectedType = blueprintType || 'general';
  const templatePrompt = getPrompt(selectedType);
  
  // If user provided additional instructions, append them
  let prompt = templatePrompt;
  if (userPrompt && userPrompt.trim()) {
    prompt += `\n\nADDITIONAL USER INSTRUCTIONS:\n${userPrompt}`;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Data } }
        ]
      }
    ],
    config: {
      systemInstruction: getSystemInstruction(),
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          analysisSummary: { type: Type.STRING, description: 'A detailed paragraph summarizing the overall blueprint, including scale, orientation, and key findings' },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: 'A unique identifier for this item' },
                type: { type: Type.STRING, enum: ['room', 'dimension', 'door_schedule', 'window_schedule', 'general_note', 'other'] },
                label: { type: Type.STRING, description: 'Short descriptive label' },
                description: { type: Type.STRING, description: 'Detailed description including specifications, sizes, materials' },
                value: { type: Type.STRING, description: 'Any specific value like a measurement, size, or quantity — transcribe exactly as shown' },
                boundingBox: {
                  type: Type.OBJECT,
                  properties: {
                    xMin: { type: Type.NUMBER },
                    yMin: { type: Type.NUMBER },
                    xMax: { type: Type.NUMBER },
                    yMax: { type: Type.NUMBER }
                  },
                  required: ['xMin', 'yMin', 'xMax', 'yMax']
                },
                confidence: { type: Type.NUMBER, description: 'Confidence score 0-1. Use lower values for hard-to-read or ambiguous elements.' }
              },
              required: ['id', 'type', 'label', 'boundingBox', 'confidence']
            }
          }
        },
        required: ['analysisSummary', 'items']
      }
    }
  });

  if (!response.text) {
    throw new Error('No valid response from Gemini.');
  }

  return JSON.parse(response.text);
}

export async function explainArchitecturalTerm(term: string, context?: string): Promise<string> {
  const ai = getAiClient();
  
  const template = getExplainPrompt();
  const prompt = template
    .replace('{term}', term)
    .replace('{context}', context ? ` in the context of: ${context}` : '');
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: getSystemInstruction(),
    }
  });

  return response.text || 'No explanation generated.';
}

export async function translateBlueprintData(
  data: BlueprintData,
  targetLanguage: string
): Promise<BlueprintData> {
  const ai = getAiClient();
  const prompt = `Translate all text fields (analysisSummary, items.label, items.description, items.value) in the following blueprint JSON data to ${targetLanguage}. Keep the JSON structure exactly the same, only translate the text values. Maintain architectural accuracy.\n\nJSON:\n${JSON.stringify(data, null, 2)}`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          analysisSummary: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING },
                label: { type: Type.STRING },
                description: { type: Type.STRING },
                value: { type: Type.STRING },
                boundingBox: {
                  type: Type.OBJECT,
                  properties: {
                    xMin: { type: Type.NUMBER },
                    yMin: { type: Type.NUMBER },
                    xMax: { type: Type.NUMBER },
                    yMax: { type: Type.NUMBER }
                  },
                  required: ['xMin', 'yMin', 'xMax', 'yMax']
                },
                confidence: { type: Type.NUMBER }
              },
              required: ['id', 'type', 'label', 'boundingBox', 'confidence']
            }
          }
        },
        required: ['analysisSummary', 'items']
      }
    }
  });

  if (!response.text) {
    throw new Error('No valid translation response from Gemini.');
  }

  return JSON.parse(response.text);
}
