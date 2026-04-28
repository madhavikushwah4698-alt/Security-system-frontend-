import { requestJson } from '../api';

export interface TranslationResult {
  original: string;
  translated: string;
  detectedLanguage?: string;
  summary?: string;
  targetLang?: string;
}

/**
 * Translates text to English via the backend Gemini API.
 * All API calls are proxied through the backend — the API key never leaves the server.
 *
 * @param text - The text to translate
 * @param sourceLang - Optional source language hint
 * @returns The translated text (falls back to original on failure)
 */
export async function translateToEnglish(text: string, sourceLang?: string): Promise<string> {
  if (!text.trim()) return text;

  try {
    const data = await requestJson<TranslationResult>('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text, sourceLang }),
    });
    return data.translated || text;
  } catch (error) {
    console.error('[Translation] Request failed:', error);
    return text; // Fallback: return original text
  }
}

/**
 * Translates text to a specific target language via the backend Gemini API.
 *
 * @param text - The text to translate
 * @param targetLang - The target language (e.g. "Hindi", "Spanish", "French")
 * @returns Full translation result including original and translated text
 */
export async function translateToLanguage(text: string, targetLang: string): Promise<TranslationResult> {
  const fallback: TranslationResult = { original: text, translated: text, targetLang };

  if (!text.trim()) return fallback;

  try {
    const data = await requestJson<TranslationResult>('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text, targetLang }),
    });
    return {
      original: data.original || text,
      translated: data.translated || text,
      targetLang: data.targetLang || targetLang,
    };
  } catch (error) {
    console.error('[Translation] Request failed:', error);
    return fallback;
  }
}

/**
 * Full translation + summarization (for emergency alerts).
 *
 * @param text - Guest's emergency message
 * @param sourceLang - Optional source language hint
 * @returns Translation result with AI summary
 */
export async function translateAndSummarize(text: string, sourceLang?: string): Promise<TranslationResult> {
  const fallback: TranslationResult = { original: text, translated: text };

  if (!text.trim()) return fallback;

  try {
    const data = await requestJson<TranslationResult>('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text, sourceLang }),
    });
    return {
      original: data.original || text,
      translated: data.translated || text,
      detectedLanguage: data.detectedLanguage,
      summary: data.summary,
    };
  } catch (error) {
    console.error('[Translation] Request failed:', error);
    return fallback;
  }
}

export async function transcribeVoice(_base64Audio: string) {
  return 'Transcription is not currently enabled in this client build.';
}
