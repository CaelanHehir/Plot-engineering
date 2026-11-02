/**
 * AI Bot Teammates Personality & Action Generator
 */

import { getStoredApiKey, callGeminiJSON } from './client.js';

/**
 * Procedural fallback for generating thematic bot characters when Gemini is offline.
 * @param {string} campaignTitle
 * @param {number} count
 * @returns {Array<object>}
 */
export function generateFallbackBotCharacters(campaignTitle, count) {
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
 * @returns {Promise<Array<{ name: string, role: string, startingTrait: { name: string, type: string, description: string } }>>}
 */
export async function generateBotCharactersWithAI({
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

  const systemInstruction = `You are an expert comedy writer generating distinct, funny, slightly incompetent party game characters for "Plot Engineering".
These characters will be controlled by AI bot teammates in a cooperative party game where humans and bots solve chaotic comedic scenes.

Theme: "${campaignTitle}" (${genre})
Description: "${campaignDescription}"
Number of characters needed: ${count}

REQUIREMENTS:
1. "name": A funny, memorable name suited to the genre.
2. "role": A hilarious, hyper-specific comedic archetype or job title that fits the setting (e.g., "Deep-Cover Pigeon Enthusiast", "Uncertified Explosives Hobbyist", "Hostage Negotiator with Low Blood Sugar"). Max 6 words.
3. "startingTrait": An initial quirk with:
   - "name": Short, punchy name (2-3 words).
   - "type": "buff" | "debuff" | "neutral"
   - "description": 1 punchy sentence describing how this comedic quirk manifests.

Return STRICT JSON matching this schema:
{
  "characters": [
    {
      "name": "Character Name",
      "role": "Comedic Role / Archetype",
      "startingTrait": {
        "name": "Quirk Name",
        "type": "buff | debuff | neutral",
        "description": "Short comedic effect description"
      }
    }
  ]
}`;

  const userPrompt = `Generate ${count} distinct comedic characters for the campaign "${campaignTitle}".`;

  const executeCall = async () => {
    return await callGeminiJSON(systemInstruction, userPrompt, cleanKey, { timeoutMs: 25000 });
  };

  try {
    const res = await executeCall();
    if (res && Array.isArray(res.characters) && res.characters.length >= count) {
      return res.characters.slice(0, count);
    }
    if (res && Array.isArray(res.characters) && res.characters.length > 0) {
      const extra = generateFallbackBotCharacters(campaignTitle, count - res.characters.length);
      return [...res.characters, ...extra];
    }
  } catch (err) {
    console.warn('Initial generateBotCharactersWithAI error:', err);
    const isRetryable = err?.message?.includes('429') || err?.message?.includes('503') || err?.code === 'RATE';
    if (isRetryable) {
      await new Promise(r => setTimeout(r, 1500));
      try {
        const res = await executeCall();
        if (res && Array.isArray(res.characters) && res.characters.length > 0) {
          const list = res.characters.slice(0, count);
          if (list.length < count) {
            list.push(...generateFallbackBotCharacters(campaignTitle, count - list.length));
          }
          return list;
        }
      } catch (retryErr) {
        console.warn('Retry generateBotCharactersWithAI error:', retryErr);
      }
    }
  }

  return generateFallbackBotCharacters(campaignTitle, count);
}

/**
 * Generates in-character comedic actions for AI bot players for the current scenario.
 * 
 * @param {object} params
 * @returns {Promise<Record<string, string>>} Mapping of bot playerId -> action text
 */
export async function generateBotActionsWithAI({
  campaignTitle,
  roundIndex = 0,
  totalRounds = 1,
  scenarioText,
  scenarioSecrets,
  storySoFar,
  bots = [],
  allPlayers = [],
  apiKey
}) {
  const cleanKey = (apiKey || getStoredApiKey()).trim();
  const fallbackActions = {};
  bots.forEach(b => {
    fallbackActions[b.id] = `${b.character?.name || b.name} panicked and improvised something ridiculous!`;
  });

  if (!cleanKey || bots.length === 0) {
    return fallbackActions;
  }

  const botProfiles = bots.map(b => {
    const traits = (b.modifiers || []).map(m => `${m.name} (${m.type})`).join(', ') || 'None';
    return {
      id: b.id,
      name: b.character?.name || b.name,
      role: b.character?.role || 'Adventurer',
      traits
    };
  });

  const otherCrew = allPlayers
    .filter(p => !bots.some(b => b.id === p.id))
    .map(p => `${p.character?.name || p.name} (${p.character?.role || 'Adventurer'})`)
    .join(', ') || 'None';

  const systemInstruction = `You are a comedy improv master writing hilarious, in-character action moves for bot players in "Plot Engineering".
Plot Engineering is a party game where players submit brief actions in silence to solve an escalating comedic crisis together.

CAMPAIGN: "${campaignTitle}" (Act ${roundIndex + 1} of ${totalRounds})
SCENARIO: "${scenarioText}"
SCENE COMEDIC HOOKS: "${scenarioSecrets || 'Reward comedic synergy and playful sabotage!'}"
STORY SO FAR: "${storySoFar || 'The adventure just began.'}"
OTHER CREW MEMBERS: ${otherCrew}

BOTS YOU MUST WRITE ACTIONS FOR:
${JSON.stringify(botProfiles, null, 2)}

CRITICAL RULES FOR EACH BOT'S ACTION:
1. Stay deeply in character according to their role and traits!
2. Write a single, vivid, punchy comedic action sentence (12 to 28 words).
3. Interact with the props, NPCs, or environmental features in the scenario.
4. DO NOT write passive or cowardly answers like "stands still" or "watches"; each bot must actively attempt something memorable or chaotic.
5. Vary the tone: one bot might try an absurdly over-engineered solution, another might attempt slapstick physical comedy, and another might try an enthusiastic misunderstanding.
6. DO NOT use quotation marks around character names.
7. Write the action in 3rd person starting with a verb or the character's name (e.g., "Dives headfirst into the cabbage cart while screaming pirate sea shanties").
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

  return fallbackActions;
}
