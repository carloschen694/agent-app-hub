import { GoogleGenAI } from '@google/genai';
import { getStandardGoogleGenAI } from './googleGenAIClientRegistry';

export const getApiBaseUrl = (): string => {
  return '';
};

export const createGoogleGenAI = (apiKey: string): GoogleGenAI => {
  return getStandardGoogleGenAI({ apiKey });
};
