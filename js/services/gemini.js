// Gemini LLM Service: API Key Validation, Model Auto-Discovery, Campaign Generation & Round Judging

let cachedModelName = localStorage.getItem('chaos_coop_gemini_model') || '';
let isApiKeyVerified = false;

function getStoredApiKey() {
  return localStorage.getItem('chaos_coop_gemini_key') || '';
}

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
    'gemini-2.5-flash',
    'gemini-2.5-flash-preview',
    'gemini-3-flash-preview',
    'gemini-3-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-pro-latest'
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
    if (!sorted.includes(s)) sorted.push(s);
  }

  cachedModelName = sorted[0];
  isApiKeyVerified = true;
  localStorage.setItem('chaos_coop_gemini_model', cachedModelName);
  return sorted;
}

async function callGeminiJSON(systemInstruction, userPrompt, apiKey) {
  const cleanKey = (apiKey || getStoredApiKey()).trim();
  if (!cleanKey) {
    throw new Error('No Gemini API key provided.');
  }

  const candidateModels = await validateAndDiscoverModels(cleanKey);
  const errors = [];

  for (const model of candidateModels.slice(0, 4)) {
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
            temperature: 0.55,
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
 * Comprehensive Campaign Generation Guide & AI Campaign Builder
 */
const CAMPAIGN_GENERATION_GUIDE = `You are an expert cooperative party game designer creating a multi-round scenario campaign.

================================================================================
COMPREHENSIVE CAMPAIGN GENERATION GUIDE (CRITICAL RULES — NEVER VIOLATE)
================================================================================

For EVERY round in the campaign, you MUST generate TWO distinct things:
1. "scenario" (The Player-Facing Description)
2. "secrets" (The Hidden Judge-Only Notes on Moving Parts)

--------------------------------------------------------------------------------
PART 1: THE DESCRIPTION ("scenario") — SHOWN TO PLAYERS
--------------------------------------------------------------------------------
- This is the ONLY text the players will see during the round.
- NEVER GIVE THE SOLUTION OR HINTS INSIDE THE DESCRIPTION!
  - Do NOT tell players what they "need to do", "must do", or "can do" to pass.
  - Do NOT reveal the secret weakness, temperament, or vulnerability of the obstacle in the description.
  - FORBIDDEN BAD EXAMPLE: "A stone door refuses to open unless you impress it, outsmart it, or bypass the moat." (Spoils the solutions!)
  - FORBIDDEN BAD EXAMPLE: "A troll blocks the bridge. He looks too tough to fight, so you'll need to talk him down or distract him with the food cart." (Tells players the answer!)
  - REQUIRED GOOD EXAMPLE: "A massive troll blocks the narrow stone bridge. He glares down at your party with his arms crossed and doesn't seem to want to let anyone pass. Nearby, an overturned merchant's cart sits in the mud beside an old watchtower."
- WHAT TO INCLUDE IN THE DESCRIPTION:
  - Keep it brief and vivid (2 to 3 sentences, max 50 words).
  - State the immediate situation/obstacle blocking the party.
  - Mention 2 to 4 visible "moving parts" in the environment (e.g., NPCs/creatures, physical features, props, hazards) WITHOUT explaining how they should be used.
  - End by asking or implying the open-ended question: What do you do?

--------------------------------------------------------------------------------
PART 2: THE SECRETS ("secrets") — ONLY SHOWN TO THE JUDGE LLM
--------------------------------------------------------------------------------
- Players NEVER see this field. It is passed exclusively to the AI Judge LLM when evaluating what happens.
- Contains elaborated descriptions of the different moving parts in the scene: their hidden properties, immunities, vulnerabilities, and how they react when interacted with.
- CANONICAL EXAMPLE:
  - Description ("scenario"): "A troll blocks the way. He doesn't seem to want to let anyone pass."
  - Secrets ("secrets"): "The troll can be reasoned with, flattered, bribed, or distracted, but is virtually immune to physical attacks. Fighting the troll head-on will never work, while talking to or bargaining with it is generally a good solution."
- CRITICAL RULE — KEEP SECRETS BROAD / VAGUE SO MANY ACTIONS APPLY:
  - NEVER design a hyper-specific "moon-logic" puzzle where only one exact action works (e.g., NEVER write "The troll only moves if someone sings a lullaby while holding a blue mushroom").
  - Instead, write VAGUE, BROAD truths about the moving parts so that MANY different creative player actions will apply to them!
  - Define broad categories of what NEVER works (immunities, traps, backfires) vs. broad categories of what GENERALLY works (e.g., social reasoning, stealth/distraction, leverage/physics, temperature/electricity, teamwork).
  - Elaborate on the moving parts mentioned in the description (e.g., what the main threat is immune/vulnerable to, and what the nearby props or terrain features actually contain or do if players interact with them).

--------------------------------------------------------------------------------
PART 3: MULTI-ROUND ARC & ESCALATION
--------------------------------------------------------------------------------
- Connect the rounds into a cohesive, escalating story arc from Act I (Setup) to the Final Act (Climax).
- Vary the types of obstacles across rounds so the same tactic (like brute force or sweet-talking) doesn't solve every single round.

Return ONLY valid JSON matching this exact structure:
{
  "title": "Campaign Title",
  "icon": "Single relevant emoji",
  "genre": "Short genre tag",
  "description": "1 short sentence describing who the players are and their overarching goal.",
  "rounds": [
    {
      "title": "Act I: Short Round Title",
      "scenario": "Player-facing description ONLY (2-3 sentences, max 50 words). Present the obstacle and visible moving parts WITHOUT giving away any solutions or hints!",
      "secrets": "Judge-only hidden details (2-3 sentences). Elaborate on the moving parts, immunities (what will never work), and broad vulnerabilities (what categories of actions will generally work) kept vague enough so many creative actions apply."
    }
  ]
}`;

async function generateCampaignWithAI(promptText, numRounds = 4, apiKey = '') {
  const userPrompt = `Create a ${numRounds}-round campaign based on this idea: "${promptText}".
Remember:
1. For each round, generate both "scenario" (shown to players — NO solutions or hints!) and "secrets" (only shown to the judge LLM — broad/vague truths about the moving parts, what approaches never work, and what categories of actions generally work).
2. Make sure the rounds form a connected story arc from beginning to climax!`;

  const result = await callGeminiJSON(CAMPAIGN_GENERATION_GUIDE, userPrompt, apiKey);
  const rawRounds = Array.isArray(result.rounds) && result.rounds.length > 0
    ? result.rounds
    : [{
        title: 'Act I: The Crisis Begins',
        scenario: promptText,
        secrets: 'Direct brute force without a plan fails; clever use of the environment, teamwork, or social manipulation succeeds.'
      }];

  return {
    id: 'ai-' + Date.now(),
    title: result.title || 'AI Generated Campaign',
    icon: result.icon || '✨',
    genre: result.genre || 'Custom AI Adventure',
    description: result.description || promptText,
    rounds: rawRounds.map((r, i) => ({
      title: r.title || `Act ${i + 1}`,
      scenario: r.scenario || r.description || promptText,
      secrets: r.secrets || 'Unthinking brute force fails; creative teamwork, social interaction, or clever use of the environment succeeds.'
    }))
  };
}

/**
 * Judge a round of player actions using Gemini
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
    forgiving: 'FORGIVING: Be generous with creative attempts, but STILL strictly penalize vague or impossible actions and enforce the scenarioSecrets.',
    balanced: 'BALANCED: Reward specific, funny, and synergizing plans that fit scenarioSecrets with FLYING_COLORS; messy/partial plans with BARELY_PASSED; and vague, impossible, conflicting, or secret-violating plans with FAILED.',
    brutal: 'STRICT & BRUTAL: Demand tight tactical synergy that respects scenarioSecrets. Any vague, impossible, or uncoordinated action causes failure or heavy debuffs.'
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

  const systemPrompt = `You are the strict, logical AI Game Master for a multiplayer party game where players submit actions for a scenario without communicating.

CRITICAL NARRATIVE & LOGIC RULES (NEVER VIOLATE THESE):
1. ENFORCE THE HIDDEN SCENARIO SECRETS ("scenarioSecrets"):
   - You are provided with "scenarioSecrets", which only YOU (the Judge) can see. It elaborates on the hidden moving parts, immunities, and vulnerabilities in the scene.
   - Strictly evaluate player actions against "scenarioSecrets"!
   - EXAMPLE: If the scenario is "A troll blocks the way" and "scenarioSecrets" states "The troll can be reasoned with, but is virtually immune to physical attacks", then any player trying to fight or physically attack the troll WILL NEVER succeed at defeating or moving it, whereas talking to, bribing, or reasoning with it is a good solution.
   - Because "scenarioSecrets" are intentionally broad/vague, allow any specific, creative player action that logically applies to those truths to work!

2. NO "FAILING UPWARD", NO ACCIDENTAL WINS, & NO INVENTED FOLLOW-UP ACTIONS:
   - Characters ONLY attempt what their player literally wrote. NEVER invent extra follow-up steps on a player's behalf to help them pass!
   - FORBIDDEN EXAMPLE 1: A player writes "I punch John" (when no John exists). Do NOT write that he misses, falls into a crate, bewilders the guards into forgetting their posts, and "seizes the moment to scramble through the service entrance"! He never wrote that he sneaks through the entrance, and guards do not abandon their posts just because someone acts crazy. Instead, he swings at air, faceplants, and the guards immediately detain or eject him.
   - FORBIDDEN EXAMPLE 2: A player writes a vague or clumsy action, and "while flailing around, accidentally hits the emergency bulkhead button, saving the crew!" NEVER let a failed, vague, random, or nonsensical action accidentally trigger a win or solve the objective!
   - A scenario can ONLY pass (FLYING_COLORS or BARELY_PASSED) if at least one un-interrupted player wrote a DELIBERATE, SPECIFIC, PHYSICALLY POSSIBLE action that logically solves the core threat according to "scenarioSecrets". Otherwise, "deliberateSolutionExists" MUST be false and "outcome" MUST be "FAILED".

3. CAUSAL CONSISTENCY & PLAYER-VS-PLAYER INTERFERENCE:
   - Do NOT narrate each player's action in isolation one after another like separate bullet points. All actions happen in the same shared physical reality.
   - If Player A attacks, tackles, restrains, blocks, or sabotages Player B (e.g., "Bob ignores the hull breach to pummel Vlad"), Player B's submitted action is INTERRUPTED AND PREVENTED!
   - FORBIDDEN EXAMPLE: "Bob pummels Vlad. Vlad tries to charm the vacuum of space." (Inconsistent! Vlad cannot calmly perform his own action while Bob is pummeling him!)
   - CORRECT CAUSAL WRITING: Show Bob tackling/pummeling Vlad before Vlad can act, completely preventing Vlad's planned action (and hurting the team's chances).

WHAT TO PENALIZE HEAVILY (RANK LOW & CAUSE FAILURE/DEBUFFS):
1. VAGUE DESCRIPTIONS:
   - Penalize generic or lazy statements that don't explain HOW they do it (e.g., "I use my item to accomplish the main objective", "I improvise a tool and rush toward the main objective", "I solve the problem", "I help the team").
   - A vague action accomplishes NOTHING (and NEVER causes a lucky accident). Rank them at the bottom!
2. IMPOSSIBLE / NONSENSICAL / GOD-MODING DESCRIPTIONS:
   - Penalize physically impossible actions, superpowers, inventing items not in the scenario/modifiers, or acting on imaginary things not in the scene (e.g., "I fly over the obstacle", "I charm the vacuum of space", "I punch a phantom named John").
   - Have them fail painfully in reality, rank them last, and give them a concrete injury or meta penalty (if the team passes the round)!
3. ACTIONS THAT VIOLATE "scenarioSecrets", SABOTAGE TEAMMATES, OR IGNORE MODIFIERS:
   - If a player uses an approach that "scenarioSecrets" says is ineffective or doomed (e.g., physically attacking an immune enemy), their action fails!
   - Attacking a teammate ruins both the attacker's and the victim's turn and heavily drags the party toward FAILED.
   - If a player has an injury/debuff (e.g., "Broken Leg", "Concussed", "Handcuffed") and tries an action that violates it, it fails immediately.

WHAT TO REWARD HIGHLY (RANK #1 & PUSH TOWARD FLYING_COLORS):
1. FUNNY DESCRIPTIONS (THAT MAKE SENSE & FIT THE SECRETS):
   - Reward clever, humorous, in-character actions that realistically use the environment, props, or their character concept in a way that aligns with "scenarioSecrets"!
2. SYNERGIZING DESCRIPTIONS (TEAMWORK COMBOS!):
   - Heavily reward players whose independent actions naturally combo together (e.g., Player A creates a believable distraction while Player B explicitly sneaks behind the guards to unlock the door or grab the keycard). Highlight their combo in the story!

PERKS & STATUS EFFECTS — MUST BE CONCRETE OR META (NO ABSTRACT FLUFF!):
- CRITICAL RULE FOR FAILED ROUNDS: If "outcome" is "FAILED", NO ONE gets any perks, items, or status effects! Set "modifiersAdded": [] and "modifiersRemoved": [] for EVERY player when the team fails the round!
- NEVER invent abstract or poetic perks like "Empty Pockets (Confusion from imagining objects)".
- When the team PASSES ("FLYING_COLORS" or "BARELY_PASSED"), every modifier in "modifiersAdded" MUST be either:
  A) A CONCRETE RPG CONDITION OR ITEM ("metaEffect": "NONE"):
     - Concrete Debuffs ("type": "debuff"): "Concussed", "Sprained Ankle", "Broken Arm", "Exhausted", "Bleeding", "Pepper-Sprayed", "Tied Up", "Disarmed".
     - Concrete Buffs/Items ("type": "buff"): "Guard's Keycard", "Stolen Taser", "First-Aid Kit", "Security Disguise", "Crowbar", "Adrenaline Rush".
  B) A META GAME-ALTERING STATUS ("type": "meta"):
     - Use "metaEffect": "SKIP_TURN" when a character is captured, jailed, knocked unconscious, or trapped (e.g., name: "Jailed", "Knocked Unconscious", "Locked in Freezer" — locks the player out of acting for the next 1 round!).
     - Use "metaEffect": "DEAD" ONLY when a character does something fatally reckless or dies in the scene (e.g., name: "Dead" — permanently eliminates that character for the rest of the campaign!).
     - Use "metaEffect": "WORD_LIMIT" when a character is winded, gagged, or dazed (e.g., name: "Winded (5-Word Limit)" — restricts the player to typing max 5 words next round!).
     - Use "metaEffect": "BLINDED_SCENARIO" when a character is flashbanged, pepper-sprayed, or in the dark (e.g., name: "Blinded" — blacks out half the scenario text on their screen next round!).
- Note: If a locked-out ("SKIP_TURN") player is explicitly rescued/freed by a teammate's action during a passed round, include their lockout modifier name in "modifiersRemoved"!

KEEP OUTPUT SHORT & DIRECT (NO TANGENTS!):
- "storyParagraphs": Write ONLY 2 short, punchy paragraphs (60 to 90 words TOTAL combined). Focus on how the players' actions causally interact with the moving parts and unfold in the scenario.
- "evaluation": 1 short sentence (max 18 words) per player explaining why they ranked there (call out vague/impossible/sabotage penalties or synergy/humor rewards!).

THREE OUTCOMES ("outcome"):
- "FLYING_COLORS": Passed with flying colors! Deliberate, logical actions (especially funny or synergizing combos) cleanly solved the scenario in accordance with "scenarioSecrets".
- "BARELY_PASSED": Passed, but just barely! At least one player's deliberate, logical action genuinely solved the core obstacle in accordance with "scenarioSecrets", even though other teammates fumbled, got hurt, or were useless.
- "FAILED": Scenario failed — ends the game immediately! Use this whenever NO player wrote a deliberate, un-interrupted, logical solution that works under "scenarioSecrets", or when teammates sabotaged the only viable plan. (Award 0 points and 0 perks/modifiers to everyone!)

JUDGING DIFFICULTY:
${strictnessGuide}

Return ONLY valid JSON matching this exact schema (complete the analysis fields FIRST before choosing outcome and storyParagraphs):
{
  "causalInterferenceAnalysis": "1 sentence checking if any player attacked, blocked, or interfered with another player, and stating whose action was interrupted/prevented as a result.",
  "deliberateSolutionExists": true,
  "solutionCheckReason": "1 sentence verifying whether at least one un-interrupted player wrote a deliberate, logical action that solves the scenario according to scenarioSecrets without accidental luck or invented follow-ups.",
  "outcome": "FLYING_COLORS | BARELY_PASSED | FAILED",
  "headline": "Short 4-8 word verdict headline",
  "storyParagraphs": [
    "Short paragraph 1 (how the actions causally unfold and collide with the moving parts)...",
    "Short paragraph 2 (the realistic consequence on the scenario)..."
  ],
  "continuityBridge": "1 brief sentence setting up what happens next.",
  "rankings": [
    {
      "playerId": "exact playerId from input",
      "rank": 1,
      "title": "Short Award Title",
      "evaluation": "1 brief sentence explaining their impact.",
      "modifiersAdded": [
        {
          "name": "Concrete Perk/Condition Name (leave array empty [] if outcome is FAILED)",
          "type": "buff | debuff | meta",
          "metaEffect": "NONE | SKIP_TURN | DEAD | WORD_LIMIT | BLINDED_SCENARIO",
          "description": "Short concrete rule (e.g. Locked out for 1 round, or Cannot run/jump)"
        }
      ],
      "modifiersRemoved": ["Exact Old Modifier Name if cured/rescued/used (leave empty [] if outcome is FAILED)"]
    }
  ]
}`;

  const userPrompt = JSON.stringify({
    campaignTitle: campaign.title,
    roundNumber: roundIndex + 1,
    totalRounds,
    storySoFar: storySoFar || 'Opening act.',
    currentScenario: scenarioText,
    scenarioSecrets: scenarioSecrets || 'No special immunities specified; judge based on realistic physics, logic, and teamwork.',
    playersAndActions: playerProfiles
  }, null, 2);

  const res = await callGeminiJSON(systemPrompt, userPrompt, apiKey);
  return normalizeJudgeResult(res, players, settings);
}

/**
 * Normalize and calculate point awards from the AI judgment.
 * No points or perks/modifiers are given to anyone when the team fails a round.
 */
function normalizeJudgeResult(raw, players, settings = {}) {
  let outcome = String(raw.outcome || '').toUpperCase().trim();
  if (raw.deliberateSolutionExists === false) {
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
        title: r.title || 'Participant',
        evaluation: r.evaluation || 'Took part in the scenario.',
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
        title: 'Bystander',
        evaluation: 'Stayed out of the way.',
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
    FLYING_COLORS: 'Clean Teamwork Solves the Crisis!',
    BARELY_PASSED: 'Messy Execution, But You Scraped By!',
    FAILED: 'Uncoordinated Chaos Dooms the Party!'
  };

  return {
    outcome,
    passed,
    headline: raw.headline || defaultHeadlines[outcome],
    storyParagraphs: Array.isArray(raw.storyParagraphs) && raw.storyParagraphs.length > 0
      ? raw.storyParagraphs.slice(0, 3)
      : ['Everyone acted at once without a shared plan.'],
    continuityBridge: raw.continuityBridge || '',
    rankings: normalizedRankings
  };
}

/**
 * Offline Mock AI Judge
 */
function mockJudgeRound({ players, submissions, settings }) {
  const actions = players.map(p => (submissions[p.id] || '').trim());
  const detailedCount = actions.filter(a => a.length >= 25).length;
  const nonEmptyCount = actions.filter(a => a.length >= 5).length;

  let outcome = 'BARELY_PASSED';
  if (nonEmptyCount < Math.ceil(players.length * 0.5)) {
    outcome = 'FAILED';
  } else if (detailedCount >= Math.ceil(players.length * 0.75)) {
    outcome = 'FLYING_COLORS';
  }

  const storyParagraphs = [
    players.map(p => `${p.character?.name || p.name} tried to "${submissions[p.id] || 'do nothing'}".`).join(' '),
    outcome === 'FLYING_COLORS'
      ? 'Their moves connected cleanly and resolved the crisis without a hitch.'
      : outcome === 'BARELY_PASSED'
      ? 'Their uncoordinated moves caused some painful collisions, but they barely got the job done.'
      : "Their conflicting actions got in each other's way and failed to stop the threat."
  ];

  const sampleTitles = ['MVP', 'Wildcard', 'Bruised Survivor', 'Liability'];
  const buffMods = [
    { name: 'Guard Keycard', type: 'buff', metaEffect: 'NONE', description: 'Unlocks one security door or elevator' },
    { name: 'Adrenaline Rush', type: 'buff', metaEffect: 'NONE', description: 'Boosts strength for one physical stunt' }
  ];
  const debuffMods = [
    { name: 'Concussed', type: 'debuff', metaEffect: 'NONE', description: 'Dizzy; cannot aim or perform delicate tasks' },
    { name: 'Jailed', type: 'meta', metaEffect: 'SKIP_TURN', description: 'Caught by guards! Locked out for 1 turn.' }
  ];

  const rankings = players.map((p, idx) => {
    const chosenMod = outcome === 'FLYING_COLORS'
      ? buffMods[idx % buffMods.length]
      : debuffMods[idx % debuffMods.length];
    return {
      playerId: p.id,
      rank: idx + 1,
      title: sampleTitles[idx % sampleTitles.length],
      evaluation: `(Demo Mode) Judged as part of a ${outcome.replace('_', ' ')} outcome.`,
      modifiersAdded: outcome === 'FAILED' ? [] : [chosenMod],
      modifiersRemoved: []
    };
  });

  return normalizeJudgeResult({
    outcome,
    headline: outcome === 'FLYING_COLORS'
      ? 'Clean Teamwork! (Demo Mode)'
      : outcome === 'BARELY_PASSED'
      ? 'Barely Scraped By! (Demo Mode)'
      : 'Mission Failed! (Demo Mode)',
    storyParagraphs,
    continuityBridge: outcome === 'FAILED' ? 'The mission ended here.' : 'The crew moves on to the next act.',
    rankings
  }, players, settings);
}
