/**
 * Gemini LLM Integration Service for Plot Engineering
 * 
 * Handles:
 * 1. API Key storage and validation against Google's Models API (v1beta).
 * 2. Model Auto-Discovery with priority ranking (always gemini 3 flash, never 2.5).
 * 3. AI Campaign Generation: creates 3-4 act comedy stories with scenarios & hidden comedic hooks.
 * 4. AI Story Judging & Narration: evaluates player moves based on Coordination, Coherence,
 *    and Humor, ensuring funny/unrealistic moves succeed when they fit together, and
 *    explicitly narrating every character's action.
 * 5. Offline Fallback Judge: generates humorous story text and scores even without an API key.
 * 6. AI Bot Teammates: Generates themed bot characters and in-character improv moves with placeholder fallback.
 */

/**
 * Checks if a model name is allowed (e.g. Gemini 3 Flash, never 2.5).
 * @param {string} name
 * @returns {boolean}
 */
function isAllowedModel(name) {
  if (!name || typeof name !== 'string') return false;
  const lower = name.toLowerCase();
  return !lower.includes('2.5') && !lower.includes('2-5');
}

/** Cached name of the active, verified Gemini text model */
let cachedModelName = localStorage.getItem('plot_engineering_gemini_model') || '';
if (!isAllowedModel(cachedModelName)) {
  cachedModelName = '';
  localStorage.removeItem('plot_engineering_gemini_model');
}

/** Flag tracking whether the stored API key has been verified against Google's endpoint */
let isApiKeyVerified = false;

/**
 * Maps raw API/network errors to friendly messages for players.
 * Technical error details are logged to console.warn only.
 * 
 * @param {Error|any} err
 * @returns {string} User-facing message
 */
function friendlyAiError(err) {
  console.warn('AI Error Details:', err);
  if (!err) return 'The AI service did not answer. Try again.';
  if (err.name === 'AbortError' || err.code === 'TIMEOUT' || err.message?.includes('aborted') || err.message?.includes('timed out')) {
    return 'The AI request timed out. Please try again.';
  }
  if (err.code === 'INVALID' || err.message?.toLowerCase().includes('api key') || err.message?.includes('400') || err.message?.includes('401') || err.message?.includes('403')) {
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
 * Retrieves the stored Gemini API key from browser localStorage.
 * @returns {string} Clean API key or empty string
 */
function getStoredApiKey() {
  return localStorage.getItem('plot_engineering_gemini_key') || '';
}

/**
 * Stores or clears the Gemini API key in localStorage.
 * Automatically clears the cached model and verification state if key is removed.
 * 
 * @param {string} key - API key from user input
 */
function setStoredApiKey(key) {
  const clean = (key || '').trim();
  if (clean) {
    localStorage.setItem('plot_engineering_gemini_key', clean);
  } else {
    localStorage.removeItem('plot_engineering_gemini_key');
    localStorage.removeItem('plot_engineering_gemini_model');
    cachedModelName = '';
    isApiKeyVerified = false;
  }
}

/**
 * Strictly validates an API key against Google's v1beta Models API
 * and returns supported text generation models sorted by speed and quality preference.
 * 
 * @param {string} apiKey - Gemini API key to validate
 * @returns {Promise<Array<string>>} Sorted list of compatible model names
 * @throws {Error} Detailed error if key is invalid, network fails, or no models found
 */
async function validateAndDiscoverModels(apiKey) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey || cleanKey.length < 20) {
    const err = new Error('API Key is too short or empty.');
    err.code = 'INVALID';
    throw err;
  }

  // B13: Send API key via x-goog-api-key header instead of query parameter
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
    'gemini-3-flash',
    'gemini-3-flash-preview',
    'gemini-3.0-flash',
    'gemini-3.0-flash-preview'
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
      (lower.includes('gemini-3') || lower.includes('gemini-3.0')) &&
      lower.includes('flash') &&
      !sorted.includes(s)
    ) {
      sorted.push(s);
    }
  }

  // Always ensure gemini-3-flash is available as first choice
  if (!sorted.includes('gemini-3-flash')) {
    sorted.unshift('gemini-3-flash');
  }

  cachedModelName = sorted[0];
  isApiKeyVerified = true;
  localStorage.setItem('plot_engineering_gemini_model', cachedModelName);
  return sorted;
}

/**
 * Executes a structured JSON prompt against the Gemini generateContent API with
 * model caching, AbortController timeouts, and automatic fallback retry.
 * 
 * @param {string} systemInstruction - Guiding rules & output JSON schema
 * @param {string} userPrompt - Input parameters and scene payload
 * @param {string} [apiKey] - Optional explicit API key
 * @param {object} [options] - Optional config { timeoutMs, signal }
 * @returns {Promise<object>} Parsed JSON object response from the LLM
 */
async function callGeminiJSON(systemInstruction, userPrompt, apiKey, options = {}) {
  const cleanKey = (apiKey || getStoredApiKey()).trim();
  if (!cleanKey) {
    const err = new Error('No API key provided.');
    err.code = 'INVALID';
    throw err;
  }

  const timeoutMs = options.timeoutMs || 45000;

  // B13: Cache the discovered model. Re-discover only after a 404 on the cached model.
  let modelsToTry = [];
  if (cachedModelName && isAllowedModel(cachedModelName)) {
    modelsToTry.push(cachedModelName);
  } else {
    try {
      const candidateModels = await validateAndDiscoverModels(cleanKey);
      modelsToTry = candidateModels.filter(isAllowedModel);
    } catch (discErr) {
      console.warn('Initial model discovery failed, falling back to gemini-3-flash:', discErr);
      modelsToTry = ['gemini-3-flash'];
    }
  }

  const errors = [];
  let rediscovered = false;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    if (!isAllowedModel(model)) continue;

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
      // B13: Key in x-goog-api-key header instead of URL query string
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const fullPrompt = `${systemInstruction}\n\nIMPORTANT: Return ONLY valid JSON with no extra commentary.\n\nINPUT:\n${userPrompt}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: fullPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.75,
            responseMimeType: 'application/json'
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timer);
      if (options.signal) options.signal.removeEventListener('abort', onExternalAbort);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData?.error?.message || `HTTP ${response.status}`;
        errors.push(`${model}: ${msg}`);

        // B13: Re-discover models only on 404
        if (response.status === 404 && !rediscovered) {
          rediscovered = true;
          try {
            const fresh = await validateAndDiscoverModels(cleanKey);
            const remaining = fresh.filter(m => isAllowedModel(m) && !modelsToTry.slice(0, i + 1).includes(m));
            modelsToTry = modelsToTry.slice(0, i + 1).concat(remaining);
            continue;
          } catch (rediscErr) {
            console.warn('Model re-discovery after 404 failed:', rediscErr);
          }
        }

        if (response.status === 400 && msg.toLowerCase().includes('api key')) {
          const err = new Error(`Invalid Gemini API Key: ${msg}`);
          err.code = 'INVALID';
          throw err;
        }
        if (response.status === 429) {
          const err = new Error(`Rate limit exceeded: ${msg}`);
          err.code = 'RATE';
          throw err;
        }
        continue;
      }

      const data = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const textPart = parts.find(p => typeof p.text === 'string' && !p.thought) || parts[0];
      const rawText = textPart?.text;
      if (!rawText) {
        errors.push(`${model}: Empty response`);
        continue;
      }

      cachedModelName = model;
      isApiKeyVerified = true;
      localStorage.setItem('plot_engineering_gemini_model', model);
      return parseCleanJSON(rawText);
    } catch (err) {
      clearTimeout(timer);
      if (options.signal) options.signal.removeEventListener('abort', onExternalAbort);

      if (err.name === 'AbortError') {
        const cancelOrTimeout = new Error(options.signal?.aborted ? 'Operation cancelled.' : `AI request timed out after ${Math.round(timeoutMs / 1000)}s.`);
        cancelOrTimeout.code = 'TIMEOUT';
        throw cancelOrTimeout;
      }
      if (err.code === 'INVALID' || err.code === 'RATE') {
        throw err;
      }
      errors.push(`${model}: ${err.message}`);
    }
  }

  throw new Error(errors[0] || 'Failed to call Gemini API.');
}

/**
 * Extracts and parses a JSON object from raw LLM output, stripping markdown
 * code fences or surrounding text if present.
 * 
 * @param {string} text - Raw string from LLM
 * @returns {object} Parsed JSON object
 */
function parseCleanJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (match) {
      return JSON.parse(match[1]);
    }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('Could not parse AI JSON response.');
  }
}

/**
 * Campaign Generation Guide & AI Campaign Builder for Plot Engineering
 */
const CAMPAIGN_GENERATION_GUIDE = `You are an expert comedy party game designer creating a multi-round campaign for "Plot Engineering".
The goal of Plot Engineering is for players to create hilarious, chaotic stories together by coordinating their actions in silence—NOT to solve dry, realistic physics puzzles!

================================================================================
CAMPAIGN GENERATION GUIDE (CRITICAL RULES)
================================================================================

For EVERY round in the campaign, you MUST generate TWO distinct things:
1. "scenario" (The Player-Facing Scene Setup)
2. "secrets" (Comedic Scene Hooks & Moving Parts for the AI Judge)

--------------------------------------------------------------------------------
PART 1: THE DESCRIPTION ("scenario") — SHOWN TO PLAYERS
--------------------------------------------------------------------------------
- This is the ONLY text the players will see during the round.
- NEVER SPOIL SOLUTIONS OR TELL PLAYERS WHAT TO DO!
  - Do NOT write "You need to distract the guard or hack the panel."
  - REQUIRED GOOD EXAMPLE: "A massive troll in a clip-on tie blocks the narrow stone bridge, glaring at your party with his arms crossed. Nearby, an overturned merchant's cart full of cabbages sits in the mud beside an old watchtower."
- WHAT TO INCLUDE IN THE DESCRIPTION:
  - Keep it brief, punchy, and vivid (2 to 3 sentences, max 50 words).
  - State the immediate situation/obstacle facing the party.
  - Include 2 to 4 fun, interactive "moving parts" (weird NPCs, props, contraptions, or environmental features) that invite comedic improvisation.

--------------------------------------------------------------------------------
PART 2: THE SECRETS ("secrets") — COMEDIC HOOKS FOR THE JUDGE LLM
--------------------------------------------------------------------------------
- Players NEVER see this field. It gives the AI Judge fun comedic lore and improv fuel about the moving parts in the scene.
- Describe the quirky personalities, secret obsessions, or funny reactions of the NPCs and props in the scene (e.g., "The troll is deeply insecure about his clip-on tie and loves dramatic flattery or slapstick distractions; the cabbage cart hides a loaded catapult").
- CRITICAL RULE — ALLOW FUNNY & UNREALISTIC IDEAS TO WORK:
  - Never write rigid roadblocks that punish cartoon logic! Keep the hidden details playful and open-ended so any funny, coherent, or coordinated team plan can play off them.

--------------------------------------------------------------------------------
PART 3: MULTI-ROUND ARC & ESCALATION
--------------------------------------------------------------------------------
- Connect the rounds into an escalating comedic storyline from the setup to the final climax.

Return ONLY valid JSON matching this exact structure:
{
  "title": "Campaign Title",
  "genre": "Short comedy/genre tag",
  "description": "1 short sentence describing who the players are and their overarching goal.",
  "rounds": [
    {
      "title": "Short Round Title (do not prefix with Act or Round)",
      "scenario": "Player-facing setup ONLY (2-3 sentences, max 50 words). Present the obstacle and fun moving parts WITHOUT giving away hints or solutions!",
      "secrets": "Judge-only comedic hooks (2-3 sentences). Fun quirks of the NPCs/props and how different creative, absurd, or coordinated actions can play out."
    }
  ]
}`;

/**
 * Generates an original multi-round campaign based on the host's prompt.
 * 
 * @param {string} promptText - User-provided story concept or genre
 * @param {number} numRounds - Number of acts to create (default 4)
 * @param {string|object} [apiKeyOrOptions] - Optional explicit API key or options object
 * @returns {Promise<object>} Structured campaign object ready for game state
 */
async function generateCampaignWithAI(promptText, numRounds = 4, apiKeyOrOptions = {}) {
  const userPrompt = `Create a ${numRounds}-round comedic campaign for Plot Engineering based on this idea: "${promptText}".
Remember:
1. For each round, generate both "scenario" (shown to players — NO solutions or hints!) and "secrets" (comedic hooks and quirky moving parts for the Judge LLM).
2. Make sure the rounds form a connected, escalating comedic story arc from beginning to climax!`;

  const apiKey = typeof apiKeyOrOptions === 'string' ? apiKeyOrOptions : (apiKeyOrOptions?.apiKey || '');
  const signal = typeof apiKeyOrOptions === 'object' ? apiKeyOrOptions?.signal : undefined;

  const result = await callGeminiJSON(CAMPAIGN_GENERATION_GUIDE, userPrompt, apiKey, {
    timeoutMs: 60000,
    signal
  });
  const rawRounds = Array.isArray(result.rounds) && result.rounds.length > 0
    ? result.rounds
    : [{
        title: 'The Chaos Begins',
        scenario: promptText,
        secrets: 'Reward any funny, coordinated, or coherent combination of player actions!'
      }];

  return {
    id: 'ai-' + Date.now(),
    title: result.title || 'AI Plot Engineering Campaign',
    genre: result.genre || 'Co-Op Comedy Adventure',
    description: result.description || promptText,
    rounds: rawRounds.map((r, i) => ({
      title: r.title ? r.title.replace(/^(Act|Round)\s+[IVX0-9]+:\s*/i, '') : `Round ${i + 1}`,
      scenario: r.scenario || r.description || promptText,
      secrets: r.secrets || 'Reward funny, coordinated, and coherent player actions that play off each other!'
    }))
  };
}

/**
 * Judges a completed round using Gemini based on Coordination, Coherence, and Humor.
 * Evaluates whether players' actions synergize and cohere, allowing funny/unrealistic moves
 * to succeed, and guarantees that every character's exact action is explicitly narrated.
 * 
 * @param {object} params
 * @param {object} params.campaign - Active campaign object
 * @param {number} params.roundIndex - Current 0-based round index
 * @param {number} params.totalRounds - Total acts in campaign
 * @param {string} params.scenarioText - Player-facing scenario
 * @param {string} params.scenarioSecrets - Judge-only comedic hooks
 * @param {string} params.storySoFar - Accumulated story continuity from past rounds
 * @param {Array<object>} params.players - Connected players roster
 * @param {Record<string, string>} params.submissions - Submissions keyed by playerId
 * @param {object} params.settings - Host settings (strictness, pointsMultiplier, etc.)
 * @param {string} params.apiKey - Active Gemini API key
 * @returns {Promise<object>} Normalized judgment payload with outcome, paragraphs, and rankings
 */
async function judgeRoundWithAI({
  campaign,
  roundIndex,
  totalRounds,
  scenarioText,
  scenarioSecrets,
  storySoFar,
  players,
  submissions,
  settings,
  apiKey
}, options = {}) {
  const strictness = settings?.strictness || 'balanced';
  const strictnessGuide = {
    forgiving: 'FORGIVING (PURE "YES, AND!" IMPROV): Be wildly generous! Weave even absurd cartoon stunts into a triumphant comedic success (clever sabotage interrupts rivals and gets rewarded, but the surviving crew still passes).',
    balanced: 'BALANCED (COMEDY, SYNERGY & RIVALRY): Reward funny, coordinated team actions OR clever, audacious player sabotage with high scores! Interrupt sabotaged players\' actions in the story and punish victims with failed actions, lockouts, or debuffs. If mutual sabotage or dogpiling occurs, let it erupt into a hilarious chain reaction. Give PASSED when sabotage, casualties, or fumbles complicate the mission; give FAILED only when infighting or lazy answers completely destroy the crew without any comedic recovery.',
    brutal: 'TOUGH CRITIC: High-stakes comedic drama! Clever sabotage pays off big for the saboteur, but messy sabotage will violently backfire, interrupt critical moves, or drag the entire team into catastrophic failure and death.'
  }[strictness] || '';

  const livingPlayers = players.filter(p => !getPlayerMetaMod(p, 'DEAD'));
  const deadPlayers = players.filter(p => Boolean(getPlayerMetaMod(p, 'DEAD')));

  const playerProfiles = livingPlayers.map(p => {
    const isLockedOut = Boolean(getPlayerMetaMod(p, 'SKIP_TURN'));
    const charName = p.character?.name || p.name;
    const action = isLockedOut
      ? `(${charName} did nothing, they are locked out)`
      : (submissions[p.id] || '(Stood there frozen and did nothing)');

    const mods = (p.modifiers || []).map(m => `${m.name} [${m.type}${m.metaEffect && m.metaEffect !== 'NONE' ? '/' + m.metaEffect : ''}: ${m.description}]`).join('; ') || 'None';
    return {
      playerId: p.id,
      playerName: p.name,
      characterName: charName,
      characterRole: p.character?.role || 'Adventurer',
      currentModifiers: mods,
      submittedAction: action
    };
  });

  const systemPrompt = `You are the witty, comedy-first AI Director and Judge for "Plot Engineering", a multiplayer party game where players engineer hilarious stories together without talking out loud.

================================================================================
CORE PHILOSOPHY: FUNNY STORIES OVER REALISTIC SOLUTIONS!
================================================================================
- The goal of Plot Engineering is to create FUNNY STORIES, NOT to find realistic solutions to problems!
- Evaluate every round on three pillars:
  1. COORDINATION: How well the players' actions work together, set each other up, or combo off one another.
  2. COHERENCE: How well the combined actions fit together into a coherent, entertaining story beat that engages with the scene (and respects active character modifiers/injuries).
  3. HUMOR: How funny, creative, vivid, and committed to the bit the actions are!

================================================================================
CRITICAL JUDGING & STORYTELLING RULES (NEVER VIOLATE)
================================================================================
1. FUNNY & UNREALISTIC ANSWERS MUST BE ALLOWED TO WORK IF THEY COORDINATE/COHERE:
   - Do NOT penalize players for cartoon physics, absurd comedy, or unrealistic ideas!
   - A funny answer—even if wildly unrealistic, over-the-top, or cartoon logic—MUST BE ALLOWED TO WORK if it works with the other players' answers or fits coherently into the comedic scene!
   - EXAMPLE: If Player A "challenges the security laser to a staring contest" while Player B "rides a rolling lobster crate past the distracted bouncers", let it work! Play into the bit ("Yes, And!") and make the story hilarious!
   - Use "scenarioSecrets" as comedic flavor, personality hooks, and improv fuel—NOT as rigid realism rules to shut down funny coordinated plans.

2. THE STORY MUST EXPLICITLY CONTAIN WHAT EACH CHARACTER DID (NO VAGUE REFERENCES!):
   - In "storyParagraphs", you MUST explicitly name EVERY SINGLE character and directly narrate the specific action they submitted!
   - NEVER vaguely reference, summarize, or skip a player's action (FORBIDDEN: "while the rest of the team helped out", "meanwhile the others caused a distraction", or paraphrasing away the specific funny details they wrote).
   - If a player wrote a specific action, the story MUST show that character actually doing that exact thing and how it interacted with everyone else's actions in the shared scene!
   - Complete "characterActionChecklist" first to verify that every single player's exact action is explicitly included in your story.

3. DO NOT PUT QUOTES AROUND CHARACTER NAMES, ROLES, ITEMS, OR QUIRKS:
   - NEVER put quotation marks around player characters' names, roles, items, perks, or quirks in "storyParagraphs" or "evaluation".
   - Seamlessly integrate characters' names, items, perks, and quirks into the natural narrative prose instead of treating them as external metadata enclosed in quotes.
   - Treat them as organic, living elements of the fictional world (e.g. write "Barnaby swung his trusty mop to block the blast" instead of "\"Barnaby\" swung his \"Trusty Mop\"").
   - Only use quotation marks when a character is speaking actual dialogue out loud.

4. SABOTAGE, BETRAYAL & PUNISHMENTS (VIABLE STRATEGY & REAL TEETH!):
   - SABOTAGE IS FULLY VIABLE & REWARDED: Players are completely allowed and encouraged to target, hinder, backstab, or narc on each other! Reward clever saboteurs with top rankings, praise in their evaluation, and funny titles (e.g. "Treacherous Mastermind", "Saboteur Supreme", "Backstab MVP", "Master of Friendly Fire").
   - NO MIRACLE RESCUES OR FREE PASSES (ABSOLUTE RULE): DO NOT invent third-party miracles or lucky coincidences to bail out sabotaged players! If Player A uses insider knowledge, bouncers, guards, or the environment to frame, expose, trip, or narc on teammates, the betrayal STICKS! Do NOT have third parties (celebrities, bouncers) suddenly forgive the victims, adopt them as an entourage, or have guards accidentally hit jackpot levers to save them. If Bob charms the celebrity for himself and tells the bouncers his teammates are stalkers, Bob strolls inside while the teammates are pinned, detained, or locked out in the street!
   - SABOTAGED ACTIONS FAIL: When a player is successfully sabotaged (especially by insider info, guards, or traps) and did not explicitly write a defensive counter-measure or evasion, THEIR ACTION FAILS COMPLETELY. They do not get to execute their plan, blind guards from inside a dogpile, or trigger secondary wins.
   - VARYING PUNISHMENTS FOR THE VICTIM (PROPORTIONAL TO SEVERITY):
     * MILD SABOTAGE (pranks, trips, stolen props, grease, petty distractions): The victim's action fails/fumbles, they rank at the bottom of active players, lose points, and receive an embarrassing debuff (e.g. "Grease-Stained", "Bruised Pride", "Pantsless").
     * MODERATE / INCAPACITATING SABOTAGE (narced on to guards who detain/handcuff them, locked in rooms, trapped in chutes, knocked unconscious): The victim is DELAYED/INCAPACITATED and MISSES THEIR NEXT ROUND! Award a lockout trait with "metaEffect": "SKIP_TURN" (e.g. "Handcuffed by Bouncers", "Locked in Walk-In Freezer", "Detained in Holding Cell"). The victim receives 0 points for this round.
     * SEVERE / FATAL SABOTAGE (shoved into death lasers, thrown off rooftops, dropped into acid vats, explosive traps): The victim DIES and is permanently eliminated from the campaign! Award "metaEffect": "DEAD" (e.g. "Vaporized by Laser Grid", "Fell from Penthouse Spire"). The victim receives 0 points and cannot act in future rounds.
   - MULTIPLE SABOTEURS & DOGPILING: When multiple players attempt to sabotage each other or dogpile on the same victim, turn it into peak comedic chaos—an escalating slapstick chain reaction or Mexican standoff where contradictory plots collide!
   - THE STAKES & RISK: Sabotage carries real risk for the saboteur too. If sabotage is clumsy, reckless, or completely wipes out the only teammate handling a fatal threat, it can backfire onto the saboteur or drag the round down into FAILED.

5. WHAT ACTUALLY CAUSES A ROUND TO FAIL OR LOSE POINTS:
   - TOTAL INCOHERENCE & CATASTROPHIC WIPEOUT: A round fails when chaotic infighting, disastrous fumbles, or non-cooperation leave the entire team incapacitated or obliterated by the scenario's hazards with zero comedic redemption or survival!
   - BOTCHED / SUICIDAL SABOTAGE: Clumsy sabotage that blows up in the saboteur's face or needlessly wipes out the team.
   - LAZY / VAGUE NON-ANSWERS: Generic filler that isn't a real action or story beat (e.g., "I solve the problem", "I win the round", "I do something cool", or leaving it blank). Lazy non-answers accomplish nothing and rank at the bottom!
   - IGNORING ACTIVE MODIFIERS: If a player has an active injury/restriction (e.g., "Broken Arm", "Handcuffed") and lazily ignores it without a funny workaround, have it backfire comedically.

6. TRAITS & MODIFIERS (STRICT NOTEWORTHINESS & DAMAGING TRAITS):
   - STRICT NOTEWORTHINESS RULE: A trait/modifier should ONLY be given to reflect genuinely noteworthy physical, environmental, or bodily occurrences that happened to that character during the round (e.g. rolling in mud -> "Muddy", doused in melted cheese -> "Cheese-Glazed", drenched in red wine -> "Wine-Soaked", lost pants -> "Pantsless", got zapped by a fuse box -> "Static Charged", arm trapped in a dumbwaiter -> "Sore Shoulder", stole a guard's keycard -> "Security Keycard").
   - ABSOLUTELY NO ABSTRACT TRAITS: Strictly avoid abstract adjectives, skills, or personality traits (FORBIDDEN: "Confident Speaker", "Charismatic", "Quick Thinker", "Brave Leader", "Sharp Mind", "Smooth Talker", "Observant", "Good Listener", "Determined").
   - If a character performed a normal action and nothing physically transformative, hazardous, or memorable happened to them, DO NOT award any trait! Set "modifiersAdded": []. In fact, in most normal rounds, several players should receive NO trait at all! Only award traits when genuinely earned by the story!
   - DAMAGING TRAITS, DEATH & LOCKOUT:
     * Actions have real, comedic consequences! A character's OWN actions (blunders, reckless stunts, provoking guards, engaging with hazards) OR a rival's deliberate sabotage can and should cause lockouts ("SKIP_TURN") or death ("DEAD")!
     * Do NOT protect characters with invincible plot armor:
       - Lockouts ("SKIP_TURN"): If a character gets arrested, detained by security, knocked unconscious, trapped in a room, or tangled in chains (whether through their own blunder or a rival's sabotage), award "SKIP_TURN" (e.g., "Detained by Bouncers", "Locked in Walk-In Freezer", "Handcuffed to Railing"). They miss their next round action, and earn 0 points for the round in which they were locked out.
       - Death ("DEAD"): If a character does something fatally reckless, steps into lethal danger, or is fatally caught in a deadly trap/backfire (e.g., incinerated by lasers, crushed by a vault door, plummeting from a skyscraper), award "DEAD". They are permanently eliminated from the campaign! In all future rounds, they do not act, their action is fixed to "<name> did nothing, they are dead", and they are excluded from the judge prompt.
     * A round CAN still pass ("PASSED") for the surviving players even if one or more characters died, got arrested, or were locked out in the process!
     * Other meta conditions: "WORD_LIMIT" (gagged/out of breath, max 5 words), "BLINDED_SCENARIO" (sauce/paint in eyes).
   - FINAL ROUND TRAIT RULE: If this is the final round of the campaign (roundNumber === totalRounds), DO NOT award any traits or modifiers! Set "modifiersAdded": [] for every player, as the campaign concludes immediately after this round and new traits are pointless.
   - If a locked-out ("SKIP_TURN") teammate is rescued by another player's action during a passed round, include their lockout modifier name in "modifiersRemoved"!
   - CRITICAL RULE FOR FAILED ROUNDS: If "outcome" is "FAILED", NO ONE gets any perks, items, or status effects! Set "modifiersAdded": [] and "modifiersRemoved": [] for EVERY player when the team fails!

7. STORY LENGTH & PACING:
   - Write 2 to 3 vivid, hilarious paragraphs in "storyParagraphs" (90 to 160 words total combined) so you have plenty of room to explicitly depict what EVERY character did and how their actions combined!
   - "evaluation": 1 punchy, funny sentence (max 20 words) per player explaining their score based on their humor, coordination, coherence, or clever sabotage!

THREE OUTCOMES ("outcome"):
- "FLYING_COLORS": Flawless triumphant victory! Can ONLY be awarded if the ENTIRE active crew succeeded with ZERO casualties, ZERO teammates detained/arrested/locked out, and ZERO successful backstabs derailing teammates.
- "PASSED": Scenario passed, BUT with complications, casualties, fumbles, or successful sabotage where one or more teammates were arrested, delayed/incapacitated ("SKIP_TURN"), killed ("DEAD"), or left behind!
- "FAILED": Comedic disaster — campaign over! Total wipeout where catastrophic infighting, suicidal sabotage, or lazy non-answers left the entire crew obliterated by the scene's hazards. (Award 0 points and 0 modifiers to everyone!)

JUDGING MODE:
${strictnessGuide}

Return ONLY valid JSON matching this exact schema (complete the checklist and analysis fields FIRST before writing storyParagraphs):
{
  "characterActionChecklist": [
    "Character Name: Exact detail of what they did and how it is explicitly shown in storyParagraphs"
  ],
  "coordinationAndCoherenceAnalysis": "1-2 sentences evaluating how the players' actions interacted, including any clever sabotage, interruptions, or chain reactions (rewarding both teamwork and clever sabotage!).",
  "humorEvaluation": "1 sentence highlighting the funniest actions or combinations.",
  "storyCoherentAndFunny": true,
  "outcome": "FLYING_COLORS | PASSED | FAILED",
  "headline": "Short, funny 4-8 word episode headline",
  "storyParagraphs": [
    "Paragraph 1 (explicitly naming characters and showing the exact details of what they did; integrate character names, items, and quirks seamlessly into the story without quotes)...",
    "Paragraph 2 (showing the remaining characters' exact actions and how all their moves combined into the hilarious outcome; no quotes around names or items)..."
  ],
  "continuityBridge": "1 brief comedic sentence setting up the party's state entering the next act.",
  "rankings": [
    {
      "playerId": "exact playerId from input",
      "rank": 1,
      "title": "Funny Award Title (e.g. Chief Lobster Strategist, Chaos MVP)",
      "evaluation": "1 brief sentence praising their humor/coordination or roasting their blunder (weave names and items in naturally without quotes).",
      "modifiersAdded": [
        {
          "name": "Concrete Perk/Condition Name (empty [] if outcome is FAILED)",
          "type": "buff | debuff | meta",
          "metaEffect": "NONE | SKIP_TURN | DEAD | WORD_LIMIT | BLINDED_SCENARIO",
          "description": "Short concrete effect"
        }
      ],
      "modifiersRemoved": ["Exact Old Modifier Name if cured/rescued/used (empty [] if outcome is FAILED)"]
    }
  ]
}`;

  const userPrompt = JSON.stringify({
    campaignTitle: campaign.title,
    roundNumber: roundIndex + 1,
    totalRounds,
    storySoFar: storySoFar || 'Opening act.',
    currentScenario: scenarioText,
    sceneComedicHooks: scenarioSecrets || 'Play into the comedy! Allow funny and creative actions to succeed when they coordinate and cohere.',
    playersAndActions: playerProfiles,
    ...(deadPlayers.length > 0 ? {
      deceasedPlayers: deadPlayers.map(p => `${p.character?.name || p.name} (DEAD — already eliminated; do not evaluate, grade, or award points or traits to them)`)
    } : {})
  }, null, 2);

  const isLastRound = Boolean(totalRounds && (roundIndex + 1 >= totalRounds));
  const res = await callGeminiJSON(systemPrompt, userPrompt, apiKey, {
    timeoutMs: 45000,
    signal: options.signal
  });
  const normalized = normalizeJudgeResult(res, players, settings, { isLastRound });
  normalized.judgedBy = 'ai';
  return normalized;
}

/**
 * Normalizes raw judgment data from Gemini, enforcing safe fallbacks,
 * formatting player rankings, calculating points with host multipliers,
 * and ensuring zero points/modifiers are given to anyone on round failure.
 * 
 * @param {object} raw - Parsed LLM JSON
 * @param {Array<object>} players - Player list
 * @param {object} settings - Host settings
 * @param {object} [options] - Additional options (isLastRound)
 * @returns {object} Clean judgment object
 */
function normalizeJudgeResult(raw, players, settings = {}, options = {}) {
  const isLastRound = Boolean(options.isLastRound);
  let outcome = String(raw.outcome || '').toUpperCase().trim();
  // Support both storyCoherentAndFunny and deliberateSolutionExists (backward compatibility)
  if (raw.storyCoherentAndFunny === false || raw.deliberateSolutionExists === false) {
    outcome = 'FAILED';
  } else if (!['FLYING_COLORS', 'PASSED', 'BARELY_PASSED', 'FAILED'].includes(outcome)) {
    if (raw.passed === false || outcome.includes('FAIL')) {
      outcome = 'FAILED';
    } else if (outcome.includes('BARE') || outcome.includes('CLOSE') || outcome.includes('PASS')) {
      outcome = 'PASSED';
    } else {
      outcome = 'FLYING_COLORS';
    }
  } else if (outcome === 'BARELY_PASSED') {
    outcome = 'PASSED';
  }

  const passed = outcome !== 'FAILED';
  const multiplier = Number(settings?.pointsMultiplier) || 1;

  const rawRankings = Array.isArray(raw.rankings) ? raw.rankings : [];
  const seenIds = new Set();
  const normalizedRankings = [];

  rawRankings.sort((a, b) => (a.rank || 99) - (b.rank || 99));

  for (const r of rawRankings) {
    const p = players.find(pl => pl.id === r.playerId || pl.name === r.playerId || pl.character?.name === r.playerId);
    if (p && !seenIds.has(p.id)) {
      if (getPlayerMetaMod(p, 'DEAD')) continue; // Dead players handled separately at the end
      seenIds.add(p.id);
      const cleanModsAdded = (!passed || isLastRound)
        ? []
        : (Array.isArray(r.modifiersAdded) ? r.modifiersAdded.slice(0, 2) : []).map(m => ({
            name: m.name || 'Condition',
            type: ['buff', 'debuff', 'meta'].includes(m.type) ? m.type : 'debuff',
            metaEffect: ['NONE', 'SKIP_TURN', 'DEAD', 'WORD_LIMIT', 'BLINDED_SCENARIO'].includes(m.metaEffect)
              ? m.metaEffect
              : 'NONE',
            description: m.description || ''
          }));

      const cleanModsRemoved = !passed
        ? []
        : (Array.isArray(r.modifiersRemoved) ? r.modifiersRemoved : []);

      normalizedRankings.push({
        playerId: p.id,
        rank: normalizedRankings.length + 1,
        title: r.title || 'Scene Stealer',
        evaluation: r.evaluation || 'Committed to the bit!',
        modifiersAdded: cleanModsAdded,
        modifiersRemoved: cleanModsRemoved
      });
    }
  }

  for (const p of players) {
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      const isDead = Boolean(getPlayerMetaMod(p, 'DEAD'));
      const charName = p.character?.name || p.name;
      normalizedRankings.push({
        playerId: p.id,
        rank: normalizedRankings.length + 1,
        title: isDead ? 'Deceased' : 'Background Extra',
        evaluation: isDead ? `${charName} did nothing, they are dead.` : 'Watched the chaos unfold.',
        modifiersAdded: [],
        modifiersRemoved: []
      });
    }
  }

  // If any player died, was detained, or locked out, cap outcome at PASSED
  const hadCasualtiesOrLockouts = normalizedRankings.some(r =>
    (r.modifiersAdded || []).some(m => m.metaEffect === 'DEAD' || m.metaEffect === 'SKIP_TURN')
  );
  if (outcome === 'FLYING_COLORS' && hadCasualtiesOrLockouts) {
    outcome = 'PASSED';
  }

  const baseTeamBonus = outcome === 'FLYING_COLORS' ? 600 : (outcome === 'PASSED' ? 300 : 0);
  const rankBonusTable = [500, 350, 250, 175, 125, 100, 75, 50];

  normalizedRankings.forEach((item, idx) => {
    const pl = players.find(p => p.id === item.playerId);
    const wasAlreadyDead = Boolean(getPlayerMetaMod(pl, 'DEAD'));
    const gotDeadOrLockedOut = (item.modifiersAdded || []).some(m => m.metaEffect === 'DEAD' || m.metaEffect === 'SKIP_TURN');

    if (!passed || wasAlreadyDead) {
      item.teamBonus = 0;
      item.rankBonus = 0;
      item.pointsAwarded = 0;
      item.modifiersAdded = [];
      item.modifiersRemoved = [];
      if (wasAlreadyDead) {
        item.title = 'Deceased';
        item.evaluation = `${pl ? (pl.character?.name || pl.name) : 'Player'} did nothing, they are dead.`;
      }
    } else if (gotDeadOrLockedOut) {
      // Severe punishment: Detained/incapacitated/dead players earn 0 points for this round
      item.teamBonus = 0;
      item.rankBonus = 0;
      item.pointsAwarded = 0;
    } else {
      const teamBonus = Math.round(baseTeamBonus * multiplier);
      const rankBonus = Math.round((rankBonusTable[idx] ?? 50) * multiplier);
      item.teamBonus = teamBonus;
      item.rankBonus = rankBonus;
      item.pointsAwarded = teamBonus + rankBonus;
    }
  });

  // Re-sort rankings by points awarded descending so ranks and medals match points
  normalizedRankings.sort((a, b) => (b.pointsAwarded || 0) - (a.pointsAwarded || 0));
  normalizedRankings.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  const defaultHeadlines = {
    FLYING_COLORS: 'Hilarious Synergy Steals the Show!',
    PASSED: 'The Crew Survives the Chaos!',
    BARELY_PASSED: 'The Crew Survives the Chaos!',
    FAILED: 'Incoherent Chaos Derails the Plot!'
  };

  return {
    outcome,
    passed,
    headline: raw.headline || defaultHeadlines[outcome],
    storyParagraphs: Array.isArray(raw.storyParagraphs) && raw.storyParagraphs.length > 0
      ? raw.storyParagraphs.slice(0, 4)
      : ['Everyone charged in at once without a script!'],
    continuityBridge: raw.continuityBridge || '',
    rankings: normalizedRankings
  };
}

/**
 * Offline Mock AI Judge
 * Allows full gameplay testing and demo mode without an active Gemini API key.
 * Guarantees that every character's exact submitted action is explicitly narrated.
 * 
 * @param {object} params
 * @param {Array<object>} params.players - Players roster
 * @param {Record<string, string>} params.submissions - Submissions dictionary
 * @param {object} params.settings - Host settings
 * @returns {object} Normalized judgment payload
 */
function mockJudgeRound({ players, submissions, settings, isLastRound = false }) {
  const actions = players.map(p => (submissions[p.id] || '').trim());
  const detailedCount = actions.filter(a => a.length >= 15).length;
  const nonEmptyCount = actions.filter(a => a.length >= 4).length;

  let outcome = 'PASSED';
  if (nonEmptyCount < Math.ceil(players.length * 0.5)) {
    outcome = 'FAILED';
  } else if (detailedCount >= Math.ceil(players.length * 0.6)) {
    outcome = 'FLYING_COLORS';
  }

  // B9: Clean quotes and handle dead/locked players without leaking status strings
  const characterActionSentences = players.map(p => {
    const charName = p.character?.name || p.name;
    const rawAct = (submissions[p.id] || '').trim();
    if (rawAct.includes('DEAD') || rawAct.includes('LOCKED OUT') || rawAct === '(Was away)') {
      return `${charName} watched from the sidelines.`;
    }
    const cleanAct = rawAct.replace(/[.!?]+$/, '') || 'stood there blinking in total silence';
    return `${charName} went with this plan: "${cleanAct}".`;
  });

  const storyParagraphs = [
    characterActionSentences.join(' '),
    outcome === 'FLYING_COLORS'
      ? 'Against all laws of physics and common sense, their absurd moves combined into a masterpiece of comedic coordination that left the room speechless!'
      : outcome === 'PASSED'
      ? 'The sheer audacity of their moves caused a pileup of slapstick chaos, but the bits connected just enough to carry the crew through to the next act!'
      : 'Unfortunately, their moves went in completely opposite directions with zero coherence, turning the scene into a glorious trainwreck!'
  ];

  const sampleTitles = [
    'Scene Stealer',
    'Comedic Anchor',
    'Yes-And Champion',
    'Wild Card Improv',
    'Slapstick Master',
    'Plot Accelerant',
    'Treacherous Mastermind',
    'Saboteur Supreme',
    'Backstab MVP',
    'Master of Friendly Fire',
    'Chaos Director',
    'Calculated Hazard'
  ];

  const sampleEvaluations = [
    'Brought razor-sharp comedic timing and committed to the bit wholeheartedly.',
    'Turned a completely ridiculous concept into the highlight of the scene.',
    'Coordinated cleanly with the rest of the crew while leaving room for everyone to shine.',
    'Executed an audaciously timed sabotage that interrupted their rival with hilarious precision.',
    'Drove the narrative forward with fearless physical humor and audacity.',
    'Attempted an outrageous betrayal that plunged the entire scene into delightful pandemonium.',
    'Embraced the core rule of improv: took what was handed to them and ran a mile with it.',
    'Delivered maximum comedic value with surprising strategic efficiency.',
    'Stole the spotlight with an unexpected twist that tied the scene together.'
  ];

  const buffMods = [
    { name: 'Stolen Security Keycard', type: 'buff', metaEffect: 'NONE', description: 'Opens restricted access doors' },
    { name: 'Velvet Rope Lasso', type: 'buff', metaEffect: 'NONE', description: 'Sturdy improvised restraint rope' },
    { name: 'Pocket Firecracker', type: 'buff', metaEffect: 'NONE', description: 'Instant explosive distraction' },
    { name: 'Stolen Chef Apron', type: 'buff', metaEffect: 'NONE', description: 'Blends into service staff corridors' },
    { name: 'Grappling Hook', type: 'buff', metaEffect: 'NONE', description: 'Scales chandeliers and ledges' },
    { name: 'Heavy Champagne Bottle', type: 'buff', metaEffect: 'NONE', description: 'High-class luxury bludgeon' }
  ];

  const debuffMods = [
    { name: 'Mud-Caked', type: 'debuff', metaEffect: 'NONE', description: 'Drips thick mud and leaves obvious tracks' },
    { name: 'Gravy-Soaked', type: 'debuff', metaEffect: 'NONE', description: 'Smells strongly of poultry and attracts animals' },
    { name: 'Singed Eyebrows', type: 'debuff', metaEffect: 'NONE', description: 'Face covered in black soot from explosion' },
    { name: 'Sprained Ankle', type: 'debuff', metaEffect: 'NONE', description: 'Limps heavily and cannot sprint' },
    { name: 'Pantsless', type: 'debuff', metaEffect: 'NONE', description: 'Lost trousers in a trap, deeply embarrassed' },
    { name: 'Concussed & Seeing Stars', type: 'debuff', metaEffect: 'NONE', description: 'Swaying dizzily with cartoon birds circling head' },
    { name: 'Trapped in Meat Locker', type: 'meta', metaEffect: 'SKIP_TURN', description: 'Frozen solid and unable to act this turn' },
    { name: 'Squashed by Falling Safe', type: 'meta', metaEffect: 'DEAD', description: 'Flattened completely and eliminated from the game' }
  ];

  // Living players are ranked by action length and fuzz; dead players are handled separately
  const livingPlayers = players.filter(p => !getPlayerMetaMod(p, 'DEAD'));
  const scoredPlayers = livingPlayers.map((p, i) => {
    const act = (submissions[p.id] || '').trim();
    const fuzz = Math.sin(i * 3.7 + act.length) * 15;
    return { p, score: act.length + fuzz };
  }).sort((a, b) => b.score - a.score);

  const availableMods = outcome === 'FLYING_COLORS' ? [...buffMods] : [...debuffMods];

  const rankings = scoredPlayers.map(({ p }, rankIdx) => {
    // Only genuinely noteworthy occurrences grant a trait (top/bottom performers); never on the last round
    const getsMod = !isLastRound && outcome !== 'FAILED' && (rankIdx === 0 || rankIdx === scoredPlayers.length - 1);
    const chosenMod = availableMods[rankIdx % availableMods.length];
    return {
      playerId: p.id,
      rank: rankIdx + 1,
      title: sampleTitles[rankIdx % sampleTitles.length],
      evaluation: sampleEvaluations[rankIdx % sampleEvaluations.length],
      modifiersAdded: getsMod ? [chosenMod] : [],
      modifiersRemoved: []
    };
  });

  const res = normalizeJudgeResult({
    outcome,
    headline: outcome === 'FLYING_COLORS'
      ? 'Pure Comedic Genius!'
      : outcome === 'PASSED'
      ? 'Slapstick Survival!'
      : 'Plot Totally Derailed!',
    storyParagraphs,
    continuityBridge: outcome === 'FAILED' ? 'The curtain falls on this disaster.' : 'The crew stumbles triumphantly into the next act.',
    rankings
  }, players, settings, { isLastRound });

  res.judgedBy = 'demo';
  return res;
}

// ============================================================================
// AI Bot Teammates Generation
// ============================================================================

/**
 * Procedural fallback for generating thematic bot characters when Gemini is offline.
 * @param {string} campaignTitle
 * @param {number} count
 * @returns {Array<object>}
 */
function generateFallbackBotCharacters(campaignTitle, count) {
  const fallbackRoles = [
    'Over-caffeinated volunteer with zero safety training',
    'Conspiracy theorist trying to document everything on a tape recorder',
    'Displaced intern following instructions far too literally',
    'Self-proclaimed expert whose certifications are entirely fabricated',
    'Dramatic method actor convinced this is an immersive rehearsal',
    'Bystander caught in the wrong place at the wrong time',
    'Former mascot who refuses to break character',
    'Over-enthusiastic tour guide who lost their group'
  ];
  const fallbackTraits = [
    { name: 'Nervous Reflexes', type: 'buff', description: 'Can dive out of danger very quickly' },
    { name: 'Pocket Junk', type: 'neutral', description: 'Carries strange miscellaneous trinkets' },
    { name: 'Overthinking', type: 'debuff', description: 'Freezes when making split-second decisions' },
    { name: 'Lucky Coin', type: 'buff', description: 'Uncanny luck with 50/50 chances' },
    { name: 'Loud Sneezing', type: 'debuff', description: 'Gives away hiding spots at dramatic moments' }
  ];

  const results = [];
  for (let i = 0; i < count; i++) {
    const role = fallbackRoles[i % fallbackRoles.length];
    const trait = fallbackTraits[i % fallbackTraits.length];
    results.push({
      name: `Agent ${String.fromCharCode(65 + i)}`,
      role: `${role} during ${campaignTitle}`,
      startingTrait: trait
    });
  }
  return results;
}

/**
 * Generates custom comedic character profiles tailored to the campaign theme for AI bot teammates.
 * 
 * @param {object} params
 * @param {string} params.campaignTitle
 * @param {string} params.campaignDescription
 * @param {string} [params.genre]
 * @param {number} params.count - Number of bot characters to generate
 * @param {object} [params.settings]
 * @param {string} [params.apiKey]
 * @returns {Promise<Array<{ name: string, role: string, startingTrait: { name: string, type: string, description: string } }>>}
 */
async function generateBotCharactersWithAI({
  campaignTitle,
  campaignDescription,
  genre = 'Comedy',
  count = 1,
  settings,
  apiKey
}) {
  const cleanKey = (apiKey || getStoredApiKey()).trim();
  if (!cleanKey) {
    return generateFallbackBotCharacters(campaignTitle, count);
  }

  const systemInstruction = `You are a comedy character designer for "Plot Engineering", a comedic tabletop party game.
Generate exactly ${count} unique, funny, and quirky fictional character profiles tailored to fit the following campaign setting:
Campaign Title: "${campaignTitle}"
Genre: "${genre}"
Campaign Premise: "${campaignDescription}"

Rules:
1. Each character must have a full name, a hilarious 1-sentence role/occupation with an absurd quirk or comedic flaw, and 1 starting trait (perk or flaw).
2. The trait must have a punchy name, a type ("buff", "debuff", or "neutral"), and a short 1-sentence description.
3. No emojis. Output STRICT JSON only conforming to the schema.

Schema:
{
  "characters": [
    {
      "name": "Full Name",
      "role": "Comedic role and quirk",
      "startingTrait": {
        "name": "Trait Name",
        "type": "buff",
        "description": "Comedic effect or quirk description"
      }
    }
  ]
}`;

  const userPrompt = `Generate ${count} comedic character profiles for the campaign "${campaignTitle}".`;

  const executeCall = async () => {
    return await callGeminiJSON(systemInstruction, userPrompt, cleanKey, { timeoutMs: 25000 });
  };

  try {
    const res = await executeCall();
    if (res && Array.isArray(res.characters) && res.characters.length > 0) {
      return res.characters.slice(0, count);
    }
  } catch (err) {
    console.warn('Initial generateBotCharactersWithAI error:', err);
    const isRetryable = err?.message?.includes('429') || err?.message?.includes('503') || err?.code === 'RATE';
    if (isRetryable) {
      await new Promise(r => setTimeout(r, 1500));
      try {
        const res = await executeCall();
        if (res && Array.isArray(res.characters) && res.characters.length > 0) {
          return res.characters.slice(0, count);
        }
      } catch (retryErr) {
        console.warn('Retry generateBotCharactersWithAI error:', retryErr);
      }
    }
  }

  return generateFallbackBotCharacters(campaignTitle, count);
}

/**
 * Generates in-character comedic improv moves for AI bot teammates responding to a scenario.
 * 
 * @param {object} params
 * @param {string} params.scenario
 * @param {string} params.roundTitle
 * @param {string} params.campaignTitle
 * @param {string} params.campaignDescription
 * @param {string} [params.storySoFar]
 * @param {Array<{ id: string, name: string, role: string, modifiers: Array<object> }>} params.botProfiles
 * @param {string} [params.apiKey]
 * @returns {Promise<Record<string, string>>} Map of bot id -> action string
 */
async function generateBotActionsWithAI({
  scenario,
  roundTitle,
  campaignTitle,
  campaignDescription,
  storySoFar,
  botProfiles,
  apiKey
}) {
  const cleanKey = (apiKey || getStoredApiKey()).trim();
  const fallbackActions = {};
  botProfiles.forEach(b => {
    fallbackActions[b.id] = `${b.name} panicked and did nothing!`;
  });

  if (!cleanKey || !botProfiles || botProfiles.length === 0) {
    return fallbackActions;
  }

  const profilesSummary = botProfiles.map(b => {
    const mods = (b.modifiers || []).map(m => `${m.name} (${m.description || m.type})`).join(', ') || 'None';
    return `- ID: ${b.id}\n  Name: ${b.name}\n  Role: ${b.role}\n  Active Traits/Injuries: ${mods}`;
  }).join('\n\n');

  const systemInstruction = `You are playing as the AI bot teammates in "Plot Engineering", a hilarious cooperative tabletop comedy game.
Write an in-character comedic action for each bot in response to the current round scenario.

Campaign: "${campaignTitle}"
Premise: "${campaignDescription}"
Round Title: "${roundTitle}"
Current Scenario: "${scenario}"
${storySoFar ? `Story Continuity So Far:\n${storySoFar}\n` : ''}

Crew of Bots to Write Moves For:
${profilesSummary}

Rules for Bot Actions:
1. Write 1-2 punchy sentences per character in the first person ("I ...") or third person ("[Name] ...").
2. Play directly into each character's unique role and personality quirks.
3. React specifically to elements, objects, or threats mentioned in the current scenario.
4. If a bot has active traits or injuries, weave them humorously into their action (e.g. compensating for an injury or misusing a perk).
5. BOT MEMORY, GRUDGES & RETALIATION: Review the Story Continuity So Far! If a teammate (human or bot) previously sabotaged, narced on, insulted, or threw this bot under the bus, DO NOT FORGIVE THEM! Hold a grudge, distrust them, refuse to assist them, or actively attempt hilarious revenge or counter-sabotage against them in your action!
6. If no grudge exists, the humor should be comedic improv (absurd cartoon plans, slapstick, high-confidence misunderstandings, creative team plays, or cheeky/mischievous sabotage against a teammate if it fits their character).
7. No emojis in actions.
8. Return STRICT JSON conforming to the schema.

Schema:
{
  "actions": {
    "${botProfiles[0].id}": "Comedic action string here"
  }
}`;

  const userPrompt = `Generate comedic actions for the ${botProfiles.length} bot character(s) in response to the scenario.`;

  const executeCall = async () => {
    return await callGeminiJSON(systemInstruction, userPrompt, cleanKey, { timeoutMs: 25000 });
  };

  try {
    const res = await executeCall();
    if (res && res.actions && typeof res.actions === 'object') {
      const result = {};
      botProfiles.forEach(b => {
        result[b.id] = (typeof res.actions[b.id] === 'string' && res.actions[b.id].trim())
          ? res.actions[b.id].trim()
          : `${b.name} panicked and did nothing!`;
      });
      return result;
    }
  } catch (err) {
    console.warn('Initial generateBotActionsWithAI error:', err);
    const isRetryable = err?.message?.includes('429') || err?.message?.includes('503') || err?.code === 'RATE';
    if (isRetryable) {
      await new Promise(r => setTimeout(r, 1500));
      try {
        const res = await executeCall();
        if (res && res.actions && typeof res.actions === 'object') {
          const result = {};
          botProfiles.forEach(b => {
            result[b.id] = (typeof res.actions[b.id] === 'string' && res.actions[b.id].trim())
              ? res.actions[b.id].trim()
              : `${b.name} panicked and did nothing!`;
          });
          return result;
        }
      } catch (retryErr) {
        console.warn('Retry generateBotActionsWithAI error:', retryErr);
      }
    }
  }

  // If retries expired or error occurred, use the specified placeholder
  return fallbackActions;
}

