import { GoogleGenAI } from '@google/genai';

interface StandardGoogleGenAIOptions {
  apiKey: string;
  baseUrl?: string;
  apiVersion?: string;
  GoogleGenAICtor?: typeof GoogleGenAI;
}

let entry: { identity: string; client: GoogleGenAI } | null = null;

export function getStandardGoogleGenAI({
  apiKey,
  baseUrl,
  apiVersion,
  GoogleGenAICtor = GoogleGenAI,
}: StandardGoogleGenAIOptions): GoogleGenAI {
  const identity = JSON.stringify([apiKey, baseUrl, apiVersion]);
  if (entry?.identity === identity) return entry.client;

  const httpOptions = {
    ...(baseUrl ? { baseUrl } : {}),
    ...(apiVersion ? { apiVersion } : {}),
  };
  const client = new GoogleGenAICtor({
    apiKey,
    ...(Object.keys(httpOptions).length > 0 ? { httpOptions } : {}),
  });
  entry = { identity, client };
  return client;
}

export function clearStandardGoogleGenAI(): void {
  entry = null;
}
