import { requestJson } from '../api';

export async function translateToEnglish(text: string, sourceLang?: string) {
  try {
    const data = await requestJson<{ translated?: string }>('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text, sourceLang }),
    });
    return data.translated || text;
  } catch (error) {
    console.error('Translation request failed:', error);
    return text;
  }
}

export async function transcribeVoice(_base64Audio: string) {
  return 'Transcription is not currently enabled in this client build.';
}
