/**
 * Gemini Services Barrel Entrypoint
 */

export {
  isAllowedModel,
  getStoredApiKey,
  setStoredApiKey,
  hasApiKey,
  isKeyVerified,
  setApiKeyVerified,
  friendlyAiError,
  validateAndDiscoverModels,
  parseCleanJSON,
  callGeminiJSON
} from './client.js';

export {
  CAMPAIGN_GENERATION_GUIDE,
  generateCampaignWithAI
} from './campaign.js';

export {
  sanitizePlayerInput,
  normalizeJudgeResult,
  judgeRoundWithAI
} from './judge.js';

export {
  mockJudgeRound
} from './fallbackJudge.js';

export {
  generateFallbackBotCharacters,
  generateBotCharactersWithAI,
  generateBotActionsWithAI
} from './bots.js';
