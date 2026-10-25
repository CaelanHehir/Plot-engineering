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
 */

/** Cached name of the active, verified Gemini text model */
let cachedModelName = localStorage.getItem('chaos_coop_gemini_model') || '';
if (cachedModelName.includes('2.5') || cachedModelName.includes('2-5')) {
  cachedModelName = '';
  localStorage.removeItem('chaos_coop_gemini_model');
}

/** Flag tracking whether the stored API key has been verified against Google's endpoint */
let isApiKeyVerified = false;

/**
 * Retrieves the stored Gemini API key from browser localStorage.
 * @returns {string} Clean API key or empty string
 */
function getStoredApiKey() {
  return localStorage.getItem('chaos_coop_gemini_key') || '';
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
    localStorage.setItem('chaos_coop_gemini_key', clean);
  } else {
    localStorage.removeItem('chaos_coop_gemini_key');
    localStorage.removeItem('chaos_coop_gemini_model');
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
    throw new Error('API Key is too short or empty.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
  let res;
  try {
    res = await fetch(url);
  } catch (networkErr) {
    throw new Error('Network error while verifying API key.');
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const models = Array.isArray(data.models) ? data.models : [];

  const supported = models
    .filter(m => {
      const methods = m.supportedGenerationMethods || [];
      const name = (m.name || '').toLowerCase();
      if (!methods.includes('generateContent')) return false;
      if (!name.includes('gemini')) return false;
      if (name.includes('2.5') || name.includes('2-5')) return false;
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
      !lower.includes('2.5') &&
      !lower.includes('2-5') &&
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
  localStorage.setItem('chaos_coop_gemini_model', cachedModelName);
  return sorted;
}

/**
 * Executes a structured JSON prompt against the Gemini generateContent API with
 * automatic fallback retry across discovered models.
 * 
 * @param {string} systemInstruction - Guiding rules & output JSON schema
 * @param {string} userPrompt - Input parameters and scene payload
 * @param {string} [apiKey] - Optional explicit API key
 * @returns {Promise<object>} Parsed JSON object response from the LLM
 */
async function callGeminiJSON(systemInstruction, userPrompt, apiKey) {
  const cleanKey = (apiKey || getStoredApiKey()).trim();
  if (!cleanKey) {
    throw new Error('No Gemini API key provided.');
  }

  const candidateModels = (await validateAndDiscoverModels(cleanKey))
    .filter(m => !m.includes('2.5') && !m.includes('2-5'));
  if (candidateModels.length === 0) {
    candidateModels.push('gemini-3-flash');
  }
  const errors = [];

  for (const model of candidateModels.slice(0, 4)) {
    if (model.includes('2.5') || model.includes('2-5')) continue;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const fullPrompt = `${systemInstruction}\n\nIMPORTANT: Return ONLY valid JSON with no extra commentary.\n\nINPUT:\n${userPrompt}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData?.error?.message || `HTTP ${response.status}`;
        errors.push(`${model}: ${msg}`);
        if (response.status === 400 && msg.toLowerCase().includes('api key')) {
          throw new Error(`Invalid Gemini API Key: ${msg}`);
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
      localStorage.setItem('chaos_coop_gemini_model', model);
      return parseCleanJSON(rawText);
    } catch (err) {
      if (err.message.includes('Invalid Gemini API Key')) {
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
- Connect the rounds into an escalating comedic adventure from Act I (Setup) to the Final Act (Climax).

Return ONLY valid JSON matching this exact structure:
{
  "title": "Campaign Title",
  "icon": "Single relevant emoji",
  "genre": "Short comedy/genre tag",
  "description": "1 short sentence describing who the players are and their overarching goal.",
  "rounds": [
    {
      "title": "Act I: Short Round Title",
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
 * @param {string} [apiKey] - Optional explicit API key
 * @returns {Promise<object>} Structured campaign object ready for game state
 */
async function generateCampaignWithAI(promptText, numRounds = 4, apiKey = '') {
  const userPrompt = `Create a ${numRounds}-round comedic campaign for Plot Engineering based on this idea: "${promptText}".
Remember:
1. For each round, generate both "scenario" (shown to players — NO solutions or hints!) and "secrets" (comedic hooks and quirky moving parts for the Judge LLM).
2. Make sure the rounds form a connected, escalating comedic story arc from beginning to climax!`;

  const result = await callGeminiJSON(CAMPAIGN_GENERATION_GUIDE, userPrompt, apiKey);
  const rawRounds = Array.isArray(result.rounds) && result.rounds.length > 0
    ? result.rounds
    : [{
        title: 'Act I: The Chaos Begins',
        scenario: promptText,
        secrets: 'Reward any funny, coordinated, or coherent combination of player actions!'
      }];

  return {
    id: 'ai-' + Date.now(),
    title: result.title || 'AI Plot Engineering Campaign',
    icon: result.icon || '🎬',
    genre: result.genre || 'Co-Op Comedy Adventure',
    description: result.description || promptText,
    rounds: rawRounds.map((r, i) => ({
      title: r.title || `Act ${i + 1}`,
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
}) {
  const strictness = settings?.strictness || 'balanced';
  const strictnessGuide = {
    forgiving: 'FORGIVING (PURE "YES, AND!" IMPROV): Be wildly generous! As long as players wrote actual actions and didn\'t directly sabotage each other, weave even the most absurd cartoon stunts into a triumphant comedic success.',
    balanced: 'BALANCED (COMEDY & SYNERGY): Reward funny, specific, and coordinated actions (even if totally unrealistic!) with FLYING_COLORS; give BARELY_PASSED when actions are funny/coherent overall but slightly messy or uncoordinated; give FAILED only when actions completely contradict/sabotage each other or are lazy/empty non-answers.',
    brutal: 'TOUGH CRITIC: Demand strong coordination, comedic commitment, and coherence between teammates! If players go off in completely unrelated directions without synergy or write low-effort actions, let their plans hilariously collide and fail.'
  }[strictness] || '';

  const playerProfiles = players.map(p => {
    const isDead = Boolean(getPlayerMetaMod(p, 'DEAD'));
    const isLockedOut = Boolean(getPlayerMetaMod(p, 'SKIP_TURN'));
    const action = isDead
      ? '(DEAD — Eliminated in a previous round and cannot act)'
      : isLockedOut
      ? '(LOCKED OUT THIS TURN due to active status — cannot act unless rescued by a teammate)'
      : (submissions[p.id] || '(Stood there frozen and did nothing)');

    const mods = (p.modifiers || []).map(m => `${m.name} [${m.type}${m.metaEffect && m.metaEffect !== 'NONE' ? '/' + m.metaEffect : ''}: ${m.description}]`).join('; ') || 'None';
    return {
      playerId: p.id,
      playerName: p.name,
      characterName: p.character?.name || p.name,
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

4. WHAT ACTUALLY CAUSES A ROUND TO FAIL OR LOSE POINTS:
   - INCOHERENCE / ANTI-COORDINATION: Players directly working against each other, attacking/sabotaging teammates, or doing completely incompatible things that ruin each other's moves (e.g., Player A tries tosweet-talk the guard while Player B tackles the guard down the stairs).
   - LAZY / VAGUE NON-ANSWERS: Generic filler that isn't a real action or story beat (e.g., "I solve the problem", "I win the round", "I do something cool", or leaving it blank). Lazy non-answers accomplish nothing and rank at the bottom!
   - IGNORING ACTIVE MODIFIERS: If a player has an active injury/restriction (e.g., "Broken Arm", "Handcuffed") and lazily ignores it without a funny workaround, have it backfire comedically.

5. CONCRETE OR META PERKS & STATUS EFFECTS (WHEN THE TEAM PASSES):
   - CRITICAL RULE FOR FAILED ROUNDS: If "outcome" is "FAILED", NO ONE gets any perks, items, or status effects! Set "modifiersAdded": [] and "modifiersRemoved": [] for EVERY player when the team fails!
   - When the team PASSES ("FLYING_COLORS" or "BARELY_PASSED"), any modifier in "modifiersAdded" MUST be concrete and fun:
     A) CONCRETE ITEM / PERK OR COMEDIC CONDITION ("metaEffect": "NONE"):
        - Buffs ("type": "buff"): Concrete items/perks gained from the scene (e.g., "Lobster Mech Suit", "Guard's Keycard", "Velvet Rope Lasso", "VIP Champagne Bottle").
        - Debuffs ("type": "debuff"): Concrete physical/comedic conditions (e.g., "Covered in Gravy", "Lobster Pinched Nose", "Sprained Ankle", "Tangled in Tape").
     B) META GAME-ALTERING STATUS ("type": "meta"):
        - "SKIP_TURN": Character is captured, trapped, or incapacitated for 1 round (e.g., "Stuffed in Laundry Cart", "Jailed").
        - "DEAD": Character did something fatally self-destructive (permanently eliminates them).
        - "WORD_LIMIT": Character is winded, gagged, or out of breath (max 5 words next round).
        - "BLINDED_SCENARIO": Character has sauce/paint/blindfold in their eyes (redacts half the scenario text next round).
   - If a locked-out ("SKIP_TURN") teammate is rescued by another player's action during a passed round, include their lockout modifier name in "modifiersRemoved"!

6. STORY LENGTH & PACING:
   - Write 2 to 3 vivid, hilarious paragraphs in "storyParagraphs" (90 to 160 words total combined) so you have plenty of room to explicitly depict what EVERY character did and how their actions combined!
   - "evaluation": 1 punchy, funny sentence (max 20 words) per player explaining their score based on their humor, coordination, and coherence!

THREE OUTCOMES ("outcome"):
- "FLYING_COLORS": Passed with flying colors! The players' actions were funny, coherent, and coordinated (even if totally unrealistic/absurd!), creating a hilarious story beat.
- "BARELY_PASSED": Passed, but just barely! Some players delivered funny, coherent actions that saved the scene, even though others clashed, fumbled, or were uncoordinated.
- "FAILED": Comedic disaster — campaign over! The team's actions completely sabotaged/contradicted each other into total incoherence, or everyone submitted lazy/empty non-answers. (Award 0 points and 0 modifiers to everyone!)

JUDGING MODE:
${strictnessGuide}

Return ONLY valid JSON matching this exact schema (complete the checklist and analysis fields FIRST before writing storyParagraphs):
{
  "characterActionChecklist": [
    "Character Name: Exact detail of what they did and how it is explicitly shown in storyParagraphs"
  ],
  "coordinationAndCoherenceAnalysis": "1-2 sentences evaluating how the players' actions coordinated and cohered together as a story (allowing funny/unrealistic moves to succeed when they fit together!).",
  "humorEvaluation": "1 sentence highlighting the funniest actions or combinations.",
  "storyCoherentAndFunny": true,
  "outcome": "FLYING_COLORS | BARELY_PASSED | FAILED",
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
    playersAndActions: playerProfiles
  }, null, 2);

  const res = await callGeminiJSON(systemPrompt, userPrompt, apiKey);
  return normalizeJudgeResult(res, players, settings);
}

/**
 * Normalizes raw judgment data from Gemini, enforcing safe fallbacks,
 * formatting player rankings, calculating points with host multipliers,
 * and ensuring zero points/modifiers are given to anyone on round failure.
 * 
 * @param {object} raw - Parsed LLM JSON
 * @param {Array<object>} players - Player list
 * @param {object} settings - Host settings
 * @returns {object} Clean judgment object
 */
function normalizeJudgeResult(raw, players, settings = {}) {
  let outcome = String(raw.outcome || '').toUpperCase().trim();
  // Support both storyCoherentAndFunny and deliberateSolutionExists (backward compatibility)
  if (raw.storyCoherentAndFunny === false || raw.deliberateSolutionExists === false) {
    outcome = 'FAILED';
  } else if (!['FLYING_COLORS', 'BARELY_PASSED', 'FAILED'].includes(outcome)) {
    if (raw.passed === false || outcome.includes('FAIL')) {
      outcome = 'FAILED';
    } else if (outcome.includes('BARE') || outcome.includes('CLOSE')) {
      outcome = 'BARELY_PASSED';
    } else {
      outcome = 'FLYING_COLORS';
    }
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
      seenIds.add(p.id);
      const cleanModsAdded = !passed
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
      normalizedRankings.push({
        playerId: p.id,
        rank: normalizedRankings.length + 1,
        title: 'Background Extra',
        evaluation: 'Watched the chaos unfold.',
        modifiersAdded: [],
        modifiersRemoved: []
      });
    }
  }

  const baseTeamBonus = outcome === 'FLYING_COLORS' ? 600 : (outcome === 'BARELY_PASSED' ? 300 : 0);
  const rankBonusTable = [500, 350, 250, 175, 125, 100, 75, 50];

  normalizedRankings.forEach((item, idx) => {
    if (!passed) {
      item.teamBonus = 0;
      item.rankBonus = 0;
      item.pointsAwarded = 0;
      item.modifiersAdded = [];
      item.modifiersRemoved = [];
    } else {
      const teamBonus = Math.round(baseTeamBonus * multiplier);
      const rankBonus = Math.round((rankBonusTable[idx] ?? 50) * multiplier);
      item.teamBonus = teamBonus;
      item.rankBonus = rankBonus;
      item.pointsAwarded = teamBonus + rankBonus;
    }
  });

  const defaultHeadlines = {
    FLYING_COLORS: 'Hilarious Synergy Steals the Show!',
    BARELY_PASSED: 'Chaotic Comedy Somehow Works Out!',
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
function mockJudgeRound({ players, submissions, settings }) {
  const actions = players.map(p => (submissions[p.id] || '').trim());
  const detailedCount = actions.filter(a => a.length >= 15).length;
  const nonEmptyCount = actions.filter(a => a.length >= 4).length;

  let outcome = 'BARELY_PASSED';
  if (nonEmptyCount < Math.ceil(players.length * 0.5)) {
    outcome = 'FAILED';
  } else if (detailedCount >= Math.ceil(players.length * 0.6)) {
    outcome = 'FLYING_COLORS';
  }

  const characterActionSentences = players.map(p => {
    const charName = p.character?.name || p.name;
    const role = p.character?.role ? ` (${p.character.role})` : '';
    const act = (submissions[p.id] || '').trim() || 'stood there blinking in total silence';
    return `${charName}${role} jumped into action and explicitly ${act.replace(/^I\s+/i, '')}.`;
  });

  const storyParagraphs = [
    characterActionSentences.join(' '),
    outcome === 'FLYING_COLORS'
      ? 'Against all laws of physics and common sense, their absurd moves combined into a masterpiece of comedic coordination that left the room speechless!'
      : outcome === 'BARELY_PASSED'
      ? 'The sheer audacity of their moves caused a pileup of slapstick chaos, but the bits connected just enough to carry the crew through to the next act!'
      : 'Unfortunately, their moves went in completely opposite directions with zero coherence, turning the scene into a glorious trainwreck!'
  ];

  const sampleTitles = ['Comedy MVP', 'Yes-And Champion', 'Chaotic Co-Star', 'Slapstick Hazard'];
  const buffMods = [
    { name: 'Prop Department Megaphone', type: 'buff', metaEffect: 'NONE', description: 'Amplifies dramatic bluffs and distractions' },
    { name: 'Unstoppable Momentum', type: 'buff', metaEffect: 'NONE', description: 'Bonus flair on absurd physical stunts' }
  ];
  const debuffMods = [
    { name: 'Dizzy from Slapstick', type: 'debuff', metaEffect: 'NONE', description: 'Wobbly aim on delicate tasks' },
    { name: 'Stuffed in a Trash Can', type: 'meta', metaEffect: 'SKIP_TURN', description: 'Stuck for 1 turn unless a teammate tips you out!' }
  ];

  const rankings = players.map((p, idx) => {
    const chosenMod = outcome === 'FLYING_COLORS'
      ? buffMods[idx % buffMods.length]
      : debuffMods[idx % debuffMods.length];
    return {
      playerId: p.id,
      rank: idx + 1,
      title: sampleTitles[idx % sampleTitles.length],
      evaluation: `(Demo Mode) Scored on coordination, coherence, and comedic commitment!`,
      modifiersAdded: outcome === 'FAILED' ? [] : [chosenMod],
      modifiersRemoved: []
    };
  });

  return normalizeJudgeResult({
    outcome,
    headline: outcome === 'FLYING_COLORS'
      ? 'Pure Comedic Genius! (Demo Mode)'
      : outcome === 'BARELY_PASSED'
      ? 'Slapstick Survival! (Demo Mode)'
      : 'Plot Totally Derailed! (Demo Mode)',
    storyParagraphs,
    continuityBridge: outcome === 'FAILED' ? 'The curtain falls on this disaster.' : 'The crew stumbles triumphantly into the next act.',
    rankings
  }, players, settings);
}
