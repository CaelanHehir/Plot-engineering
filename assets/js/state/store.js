/**
 * Plot Engineering — Central Application State Container
 */

import { PREMADE_CAMPAIGNS } from '../data/campaigns.js';

export const app = {
  /** Whether the local client is the authoritative room Host */
  isHost: false,
  /** Local peer's unique identifier */
  myId: '',
  /** Local player's chosen display name */
  myName: '',
  /** 4-letter room code (uppercase) */
  roomCode: '',
  /** PeerJS peer instance */
  peer: null,
  /** Host connection for client peers */
  hostConn: null,
  /** Client connections dictionary for Host { [playerId]: DataConnection } */
  clientConns: {},
  /** Active tab in Host campaign setup: 'campaign' | 'settings' */
  lobbyTab: 'campaign',
  /** Active mobile sub-window on HOME screen: 'host' | 'join' */
  homeWindow: 'host',
  /** Active sub-view in LOBBY: 'cast' | 'campaign' */
  lobbyView: 'cast',
  /** Character creation stage: 1 (Name & Bio) | 2 (Portrait Sketchpad) */
  charCreateStep: 1,
  /** Whether the opening scenario popup modal is currently visible */
  scenarioPopupOpen: false,
  /** Deduplication key tracking which scenario popup has already opened */
  scenarioPopupKey: '',
  /** Active sub-window on REVEAL screen: 'story' | 'rankings' */
  revealWindow: 'story',
  /** Active sub-window on GAME_OVER screen: 'results' | 'players' | 'recap' */
  gameOverWindow: 'results',
  /** Player authentication secrets mapped by playerId { [playerId]: token } (Host only, never sent to clients) */
  playerTokens: {},

  // Authoritative State (managed by Host, synchronized to Clients)
  state: {
    /** Current game phase: HOME | LOBBY | CHAR_CREATE | SCENARIO | REVEAL | GAME_OVER */
    phase: 'HOME',
    roomCode: '',
    /** Tracks whether the host has clicked 'Set up campaign' in the lobby */
    campaignSetupStarted: false,
    /** Active campaign source: 'premade' | 'ai' | 'custom' */
    campaignMode: 'premade',
    selectedPremadeId: PREMADE_CAMPAIGNS[0]?.id || 'casino-heist',
    aiPrompt: '',
    aiRoundCount: 4,
    customCampaign: {
      id: 'custom-1',
      title: 'Custom campaign',
      genre: 'Custom Story',
      description: 'A custom multi-round campaign created by the Host.',
      rounds: [
        {
          title: 'The Setup',
          scenario: 'A troll in a clip-on tie blocks the stone bridge. He crosses his arms and refuses to let anyone pass.',
          secrets: 'The troll is secretly insecure about his fashion sense and loves dramatic flattery, absurd bribes, or coordinated slapstick distractions!'
        },
        {
          title: 'The Escalation',
          scenario: '',
          secrets: ''
        },
        {
          title: 'The Climax',
          scenario: '',
          secrets: ''
        }
      ]
    },
    /** Active campaign payload for the current playthrough */
    activeCampaign: null,

    // Configurable Host Settings (Default 120s / 2 minutes)
    settings: {
      roundTimer: 120,
      charCreateTimer: 0,
      strictness: 'balanced',
      allowStartingQuirk: false,
      maxModifiers: 4,
      pointsMultiplier: 1,
      revealMovesAfterStory: true
    },

    timeLeft: 0,
    remainingMs: 0,
    currentRound: 0,
    storySoFar: '',
    roundHistory: [],
    isJudging: false,
    revealStep: 1,
    players: [],
    submissions: {},
    hiddenSubmissions: {},
    submissionKinds: {},
    currentJudgment: null
  },

  /** Active setInterval reference for timers */
  timerInterval: null,
  timerDeadline: 0,

  /** Typewriter narration playback tracker */
  typewriter: {
    activeKey: '',
    timer: null,
    finished: false
  }
};
