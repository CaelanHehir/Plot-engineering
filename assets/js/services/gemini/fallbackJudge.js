/**
 * Offline Mock AI Judge
 * Allows full gameplay testing and demo mode without an active Gemini API key.
 */

import { getPlayerMetaMod } from '../../ui/utils.js';
import { normalizeJudgeResult } from './judge.js';

export function mockJudgeRound({ players, submissions, settings, isLastRound = false }) {
  const actions = players.map(p => (submissions[p.id] || '').trim());
  const detailedCount = actions.filter(a => a.length >= 15).length;
  const nonEmptyCount = actions.filter(a => a.length >= 4).length;

  let outcome = 'PASSED';
  if (nonEmptyCount < Math.ceil(players.length * 0.5)) {
    outcome = 'FAILED';
  } else if (detailedCount >= Math.ceil(players.length * 0.6)) {
    outcome = 'FLYING_COLORS';
  }

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
    'Set up their partner for an absolute showstopper of a scene payoff.',
    'Took an absurd risk that somehow managed to pay off against all odds.',
    'Provided the steady comedic backbone that kept the scene moving.'
  ];

  const sampleModifiers = [
    { name: 'Adrenaline Buzz', type: 'buff', metaEffect: 'NONE', description: 'Feeling surprisingly energized' },
    { name: 'Sticky Fingers', type: 'buff', metaEffect: 'NONE', description: 'Items stick suspiciously well to your hands' },
    { name: 'Stage Fright', type: 'debuff', metaEffect: 'NONE', description: 'Sweating profusely under pressure' },
    { name: 'Concussion', type: 'debuff', metaEffect: 'NONE', description: 'Seeing tiny cartoon birds circling your head' },
    { name: 'Dramatic Limp', type: 'debuff', metaEffect: 'NONE', description: 'Over-acting every slight injury' }
  ];

  const livingPlayers = players.filter(p => !getPlayerMetaMod(p, 'DEAD'));
  const rankings = livingPlayers.map((p, rankIdx) => {
    const isLockedOut = Boolean(getPlayerMetaMod(p, 'SKIP_TURN'));
    const getsMod = !isLastRound && outcome !== 'FAILED' && rankIdx < 2 && Math.random() > 0.4;
    const chosenMod = sampleModifiers[(rankIdx + (p.name.length || 0)) % sampleModifiers.length];

    if (isLockedOut) {
      return {
        playerId: p.id,
        rank: rankIdx + 1,
        title: 'Locked Out',
        evaluation: `${p.character?.name || p.name} did nothing, they are locked out.`,
        modifiersAdded: [],
        modifiersRemoved: []
      };
    }

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
