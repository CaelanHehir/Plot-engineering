/**
 * AI Campaign Generator for Plot Engineering
 */

import { callGeminiJSON } from './client.js';

export const CAMPAIGN_GENERATION_GUIDE = `You are an expert comedy party game designer creating a multi-round campaign for "Plot Engineering".
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
export async function generateCampaignWithAI(promptText, numRounds = 4, apiKeyOrOptions = {}) {
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
