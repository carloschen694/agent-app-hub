import { useContext, useMemo } from 'react';
import { AgentContext } from '../../agent/context/AgentContext';
import { createGoogleGenAI } from '../auth';
import type { GoogleGenAI } from '@google/genai';

/**
 * A custom React hook that provides a reactive GoogleGenAI client instance
 * configured with the globally active API key (real or virtual) from AgentContext.
 */
export const useGoogleGenAI = (): GoogleGenAI => {
  const context = useContext(AgentContext);
  const apiKey = context?.settings?.apiKey || '';

  return useMemo(() => {
    return createGoogleGenAI(apiKey);
  }, [apiKey]);
};
