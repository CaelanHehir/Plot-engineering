/**
 * Low-Level Gemini API Client & Model Discovery
 * 
 * Security:
 * - API keys are strictly in-memory (never written to localStorage or disk).
 * - On script evaluation, legacy persistent keys are purged from browser storage.
 */

/** In-memory storage for the active session's Gemini API key */
let inMemoryApiKey = '';

/** Cached name of the active, verified Gemini text model (in-memory) */
let cachedModelName = '';

/** Verified models discovered live from the user's API key */
let verifiedModelsList = [];

/** Set of model names that returned 404 for this session */
const deadModelNames = new Set();

/** Flag tracking whether the in-memory API key has been verified against Google's endpoint */
let isApiKeyVerified = false;

// Security: Immediately purge any legacy persistent keys from browser storage
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('plot_engineering_gemini_key');
    localStorage.removeItem('plot_engineering_gemini_model');
    localStorage.removeItem('prompt_engineering_gemini_key');
    localStorage.removeItem('prompt_engineering_gemini_model');
  }
} catch (e) {}

/**
 * Substrings matching Gemini models that are deliberately blocked.
 * Note: Gemini 2.5 was an experimental iteration that exhibited unpredictable JSON formatting
 * and schema violations in turn-based games, so Flash 3, Flash 2.0, and Flash 1.5 are prioritized.
 */
export const BANNED_MODEL_SUBSTRINGS = ['2.5', '2-5'];

/**
 * Checks if a model name is allowed (e.g. Gemini 3 Flash, never 2.5).
 * @param {string} name
 * @returns {boolean}
 */
export function isAllowedModel(name) {
  if (!name || typeof name !== 'string') return false;
  const lower = name.toLowerCase();
  if (deadModelNames.has(name) || deadModelNames.has(lower)) return false;
  return !BANNED_MODEL_SUBSTRINGS.some(banned => lower.includes(banned));
}

/**
 * Retrieves the in-memory Gemini API key for this session.
 * @returns {string} Clean API key or empty string
 */
export function getStoredApiKey() {
  return inMemoryApiKey;
}

/**
 * Sets or clears the in-memory Gemini API key.
 * Never persists to localStorage or disk.
 * @param {string} key - API key from user input
 */
export function setStoredApiKey(key) {
  const clean = (key || '').trim();
  inMemoryApiKey = clean;
  if (clean) {
    isApiKeyVerified = true;
  } else {
    cachedModelName = '';
    verifiedModelsList = [];
    deadModelNames.clear();
    isApiKeyVerified = false;
  }
}

/**
 * Returns true if an API key is currently set in memory.
 * @returns {boolean}
 */
export function hasApiKey() {
  return Boolean(inMemoryApiKey);
}

/**
 * Returns true if the active in-memory API key has been verified.
 * @returns {boolean}
 */
export function isKeyVerified() {
  return isApiKeyVerified;
}

/**
 * Sets verification status of the in-memory API key.
 * @param {boolean} verified
 */
export function setApiKeyVerified(verified) {
  isApiKeyVerified = Boolean(verified);
}

/**
 * Maps raw API/network errors to friendly messages for players.
 * @param {Error|any} err
 * @returns {string} User-facing message
 */
export function friendlyAiError(err) {
  console.warn('AI Error Details:', err);
  if (!err) return 'The AI service did not answer. Try again.';
  if (err.name === 'AbortError' || err.code === 'TIMEOUT' || err.message?.includes('aborted') || err.message?.includes('timed out')) {
    return 'The AI request timed out. Please try again.';
  }
  const errMsg = String(err.message || '');
  if (err.code === 'INVALID' || errMsg.toLowerCase().includes('api key') || /\b40[13]\b/.test(errMsg)) {
    return 'Invalid AI key. Please check your key in the menu.';
  }
  if (err.code === 'RATE' || err.message?.includes('429')) {
    return 'The AI is currently busy (rate limit). Please wait a moment and try again.';
  }
  if (err.code === 'NETWORK' || err.message?.toLowerCase().includes('network') || err.message?.toLowerCase().includes('failed to fetch')) {
    return 'Network error connecting to the AI service. Please check your connection.';
  }
  return 'The AI service did not answer. Try again.';
}

/**
 * Strictly validates an API key against Google's v1beta Models API
 * and returns supported text generation models sorted by speed and quality preference.
 * 
 * @param {string} apiKey - Gemini API key to validate
 * @returns {Promise<Array<string>>} Sorted list of compatible model names
 * @throws {Error} Detailed error if key is invalid, network fails, or no models found
 */
export async function validateAndDiscoverModels(apiKey) {
  const cleanKey = (apiKey || inMemoryApiKey || '').trim();
  if (!cleanKey || cleanKey.length < 20) {
    const err = new Error('API Key is too short or empty.');
    err.code = 'INVALID';
    throw err;
  }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  let res;
  try {
    res = await fetch(url, {
      headers: {
        'x-goog-api-key': cleanKey
      },
      signal: controller.signal
    });
  } catch (networkErr) {
    clearTimeout(timer);
    const err = new Error(networkErr.name === 'AbortError' ? 'Timeout verifying API key.' : 'Network error while verifying API key.');
    err.code = networkErr.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
    throw err;
  }
  clearTimeout(timer);

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    if (res.status === 429) {
      err.code = 'RATE';
    } else if (res.status === 400 || res.status === 401 || res.status === 403) {
      err.code = 'INVALID';
    } else {
      err.code = 'NETWORK';
    }
    throw err;
  }

  const data = await res.json();
  const models = Array.isArray(data.models) ? data.models : [];

  const supported = models
    .filter(m => {
      const methods = m.supportedGenerationMethods || [];
      const name = (m.name || '').toLowerCase();
      if (!methods.includes('generateContent')) return false;
      if (!name.includes('gemini')) return false;
      if (!isAllowedModel(name)) return false;
      if (
        name.includes('tts') ||
        name.includes('image') ||
        name.includes('embedding') ||
        name.includes('aqa') ||
        name.includes('audio') ||
        name.includes('robotics') ||
        name.includes('computer-use')
      ) {
        return false;
      }
      return true;
    })
    .map(m => m.name.replace(/^models\//, ''));

  if (supported.length === 0) {
    throw new Error('No compatible Gemini text models found for this API key.');
  }

  const preferredOrder = [
    'gemini-3-flash-preview',
    'gemini-3.0-flash-preview',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-8b',
    'gemini-flash-latest'
  ];

  const sorted = [];
  for (const pref of preferredOrder) {
    const exact = supported.find(s => s === pref);
    if (exact && !sorted.includes(exact)) sorted.push(exact);
  }
  for (const pref of preferredOrder) {
    const partial = supported.find(s => s.startsWith(pref) && !sorted.includes(s));
    if (partial) sorted.push(partial);
  }
  for (const s of supported) {
    const lower = s.toLowerCase();
    if (
      isAllowedModel(lower) &&
      lower.includes('flash') &&
      !sorted.includes(s)
    ) {
      sorted.push(s);
    }
  }

  // Fallback to any remaining allowed models if none matched preferred
  for (const s of supported) {
    if (isAllowedModel(s) && !sorted.includes(s)) {
      sorted.push(s);
    }
  }

  verifiedModelsList = [...sorted];
  cachedModelName = sorted[0] || '';
  isApiKeyVerified = true;
  return sorted;
}

/**
 * Extracts and parses a JSON object from raw LLM output, stripping markdown
 * code fences or surrounding text if present.
 * 
 * @param {string} text - Raw string from LLM
 * @returns {object} Parsed JSON object
 */
export function parseCleanJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = String(text ?? '').match(/```(?:json)?\s*([\s\S]*?)```/i);
    let candidate = match ? match[1].trim() : String(text ?? '').trim();
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      candidate = candidate.slice(firstBrace, lastBrace + 1);
    }
    try {
      return JSON.parse(candidate);
    } catch (innerErr) {
      // Clean trailing commas before closing braces/brackets
      const cleaned = candidate.replace(/,\s*([}\]])/g, '$1');
      try {
        return JSON.parse(cleaned);
      } catch (finalErr) {
        throw new Error('Could not parse AI JSON response.');
      }
    }
  }
}

/**
 * Executes a structured JSON prompt against the Gemini generateContent API with
 * model cascading, AbortController timeouts, and automatic fallback retry.
 * Uses Gemini's native systemInstruction field to separate system rules from user input.
 * 
 * @param {string} systemInstruction - Guiding rules & output JSON schema
 * @param {string} userPrompt - Input parameters and scene payload
 * @param {string} [apiKey] - Optional explicit API key
 * @param {object} [options] - Optional config { timeoutMs, signal }
 * @returns {Promise<object>} Parsed JSON object response from the LLM
 */
export async function callGeminiJSON(systemInstruction, userPrompt, apiKey, options = {}) {
  const cleanKey = (apiKey || inMemoryApiKey).trim();
  if (!cleanKey) {
    const err = new Error('No API key provided.');
    err.code = 'INVALID';
    throw err;
  }

  const timeoutMs = options.timeoutMs || 45000;
  const deadline = Date.now() + (options.totalTimeoutMs || 90000);

  // If we haven't discovered models for this key yet, run discovery so we only use real endpoints
  if (verifiedModelsList.length === 0) {
    try {
      await validateAndDiscoverModels(cleanKey);
    } catch (discErr) {
      console.warn('Initial model discovery failed, using fallback list:', discErr);
    }
  }

  let modelsToTry = verifiedModelsList.filter(isAllowedModel);
  if (modelsToTry.length === 0) {
    modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-flash-latest'].filter(isAllowedModel);
  }

  const errors = [];

  for (let i = 0; i < modelsToTry.length; i++) {
    if (i > 0 && Date.now() > deadline) break;
    const model = modelsToTry[i];
    if (!isAllowedModel(model)) continue;

    // Try each model with one retry on 429
    for (let modelAttempt = 1; modelAttempt <= 2; modelAttempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const onExternalAbort = () => controller.abort();
      if (options.signal) {
        if (options.signal.aborted) {
          clearTimeout(timer);
          const cancelErr = new Error('Operation cancelled.');
          cancelErr.name = 'AbortError';
          throw cancelErr;
        }
        options.signal.addEventListener('abort', onExternalAbort, { once: true });
      }

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: `${systemInstruction}\n\nIMPORTANT: Return ONLY valid JSON with no extra commentary.`
                }
              ]
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: String(userPrompt ?? '') }]
              }
            ],
            generationConfig: {
              temperature: 0.75,
              responseMimeType: 'application/json'
            },
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
            ]
          }),
          signal: controller.signal
        });

        clearTimeout(timer);
        if (options.signal) options.signal.removeEventListener('abort', onExternalAbort);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const msg = errData?.error?.message || `HTTP ${response.status}`;
          errors.push(`${model}: ${msg}`);

          if (response.status === 404) {
            // Mark dead so it is never queried again
            deadModelNames.add(model);
            console.warn(`Model ${model} returned 404, blacklisted for session.`);
            break; // Don't retry, move to next model
          }

          if (response.status === 400 && msg.toLowerCase().includes('api key')) {
            isApiKeyVerified = false;
            const err = new Error(`Invalid Gemini API Key: ${msg}`);
            err.code = 'INVALID';
            throw err;
          }

          if (response.status === 429) {
            if (modelAttempt === 1) {
              console.warn(`Model ${model} hit rate limit (429), waiting 2s for token bucket before retry...`);
              await new Promise(r => setTimeout(r, 2000));
              continue;
            } else {
              console.warn(`Model ${model} rate limited twice, cascading to next model...`);
              await new Promise(r => setTimeout(r, 1000));
              break;
            }
          }

          // 503 or other server error: brief pause before trying next
          if (response.status === 503) {
            await new Promise(r => setTimeout(r, 1500));
          }
          break;
        }

        const data = await response.json();
        const candidate = data?.candidates?.[0];
        if (candidate?.finishReason === 'SAFETY') {
          console.warn(`Model ${model} response blocked by safety filter, cascading...`);
          errors.push(`${model}: Blocked by safety filter`);
          break;
        }
        const parts = candidate?.content?.parts || [];
        const textPart = parts.find(p => typeof p.text === 'string' && !p.thought) || parts[0];
        const rawText = textPart?.text;
        if (!rawText) {
          errors.push(`${model}: Empty response (${candidate?.finishReason || 'no candidates'})`);
          break;
        }

        cachedModelName = model;
        isApiKeyVerified = true;
        return parseCleanJSON(rawText);
      } catch (err) {
        clearTimeout(timer);
        if (options.signal) options.signal.removeEventListener('abort', onExternalAbort);

        if (err.name === 'AbortError') {
          if (options.signal?.aborted) {
            const cancelErr = new Error('Operation cancelled.');
            cancelErr.name = 'AbortError';
            throw cancelErr;
          }
          console.warn(`Model ${model} timed out after ${Math.round(timeoutMs / 1000)}s, cascading to next model...`);
          errors.push(`${model}: Timeout`);
          break;
        }
        if (err.code === 'INVALID') {
          throw err;
        }
        if (err.code === 'RATE') {
          if (modelAttempt === 1) {
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          errors.push(`${model}: Rate limit`);
          break;
        }
        errors.push(`${model}: ${err.message}`);
        break;
      }
    }
  }

  const allRateLimited = errors.length > 0 && errors.every(e => e.includes('429') || e.includes('Rate limit'));
  const finalErr = new Error(errors[0] || 'Failed to call Gemini API across models.');
  if (allRateLimited) {
    finalErr.code = 'RATE';
  }
  throw finalErr;
}
