/**
 * Static Game Data for Plot Engineering
 * 
 * Contains:
 * 1. PREMADE_CAMPAIGNS: Curated multi-round comedic storylines with player-facing
 *    scenarios and judge-only comedic hooks/secrets.
 * 2. DRAW_COLORS: Vibrant cartoon color palette for the drawing canvas sketchpad.
 */

/**
 * Pre-made multi-act comedy campaigns.
 * Each round includes:
 * - title: The act name
 * - scenario: Player-facing scene setup (obstacles & moving parts WITHOUT spoiling solutions)
 * - secrets: Judge-only comedic lore, NPC quirks, and improv hooks
 */
const PREMADE_CAMPAIGNS = [
  {
    id: 'casino-heist',
    title: 'The Grail Casino Heist',
    genre: 'Crime / Mythic Comedy',
    description: 'An audacious plan to infiltrate the ultra-luxurious The Grail Casino and steal the actual Holy Grail from the billionaire owner\'s penthouse in pursuit of eternal life. Security gets increasingly ridiculous as you climb higher.',
    rounds: [
      {
        title: 'The Red Carpet & Velvet Rope',
        scenario: 'You are all standing outside the grand entrance of The Grail Casino beneath dazzling neon lights. Two snobbish bouncers with biometric net-worth and dress-code scanners guard the velvet rope. Suddenly, a glamorous celebrity arrives in a stretch limousine, immediately mobbed by flashing paparazzi and private bodyguards.',
        secrets: 'The celebrity arrival is the ultimate distraction opportunity! She genuinely loves meeting eccentric, interesting strangers and will happily adopt a player into her entourage as an intriguing plus-one, breezing them past the bouncers and scanners. Alternatively, the biometric scanners can be fooled by counterfeit luxury props or triggering an all-out paparazzi frenzy.'
      },
      {
        title: 'Riot on the Gaming Floor',
        scenario: 'You\'ve made it inside the bustling main casino floor, but the gilded staircase and private elevators to the high-roller VIP floor are guarded by an impenetrable phalanx of security. To slip past, you need a massive distraction. Nearby, an unhinged, sleep-deprived gambler is screaming and slamming buttons on a slot machine during a catastrophic losing streak, right next to the "Mega-Jackpot Grail" machine with its sirens, confetti cannons, and pyrotechnics primed to blow.',
        secrets: 'Loud, over-the-top chaos is the key to clearing the guards! Two prime routes: 1) Agitating or goading the tilted gambler into an all-out vengeful rampage across the floor draws every guard in the sector; or 2) Rigging, triggering, or faking a jackpot on the Mega-Jackpot machine detonates an insane celebration of confetti, fireworks, and staff rushing over with giant novelty checks, leaving the VIP gates completely open!'
      },
      {
        title: 'The Posh Penthouse Antechamber',
        scenario: 'You reach the VIP High-Roller floor. Unlike the chaotic floor below, this space is deathly quiet, dripping with pretentious luxury, absurdly priced modern art, and whispered high-society conversations. Elite security guards scrutinize every corner with virtually no blind spots. Three gilded doors line the back wall: a diamond-studded double door marked "Staff Only", an ornate mirrored archway, and a discreet mahogany door with an antique brass lion knocker. Near a modern sculpture, the celebrity from the red carpet is chatting with an unassuming, modestly dressed guest.',
        secrets: 'Silly, loud, or slapstick distractions are SEVERELY PENALIZED here—elite security will instantly swarm! To breach the penthouse: 1) The unassuming guest talking to the celebrity is the billionaire owner in disguise! Impressing them through pretentious art critique, delicious gossip, sheer obnoxious snobbery, or a celebrity introduction wins penthouse access. 2) The discreet mahogany door with the lion knocker leads directly to the penthouse; guards will let anyone pass who strides up with utter, unshakeable confidence, assuming they are the disguised owner and their entourage!'
      },
      {
        title: 'Clash for the Holy Grail',
        scenario: 'You step inside the opulent penthouse suite! The Holy Grail sits glowing faintly on a pedestal in the center of the room. Suddenly, the billionaire owner confronts you in a dramatic standoff, brandishing the Grail and boasting that they\'ve already tasted from it and cannot be defeated! Through the floor-to-ceiling balcony windows behind them, a private luxury helicopter idles on the rooftop helipad against the night sky, with a dizzying drop to the streets below.',
        secrets: 'The Grail grants ridiculous, abstract superpowers to anyone who drinks from it! The owner boasts weirdly specific abilities that can either hinder or help the crew\'s actions in bizarre ways. If players manage to take a sip, they unlock their own absurd powers. Once the owner is handled, the team can either steal the rooftop helicopter to flee, or—if they drank from the Grail and gained cartoon immortality—confidently BASE-jump off the skyscraper!'
      }
    ]
  },
  {
    id: 'zombie-mall',
    title: 'Black Friday of the Dead',
    genre: 'Zombie Comedy',
    description: 'Trapped inside the MegaPlex Mall at midnight as a zombie outbreak turns bargain hunters into brain hunters.',
    rounds: [
      {
        title: 'Chaos in the Food Court',
        scenario: 'The glass doors of the mall just shattered! Dozens of zombies are shambling into the Food Court. You are cornered near a pizza counter, a novelty pretzel kiosk, and a decorative fountain while the metal security shutters are stuck halfway down.',
        secrets: 'These bargain-hunting zombies still react to free samples, slippery pizza grease, and loud "FLASH SALE!" announcements. Coordinated food-court slapstick, distracting the horde, and freeing the broom-jammed security shutter lets everyone escape!'
      },
      {
        title: 'Blackout in the Escalator Atrium',
        scenario: 'The mall power just cut out, plunging the central atrium into darkness. Between you and the 3rd-floor roof access stairs, a giant "Santa" animatronic is sparking and blaring holiday music, surrounded by a dense crowd of zombies.',
        secrets: 'The zombies are mesmerized by the malfunctioning Santa animatronic\'s disco sparks and holiday jingles. Hijacking Santa\'s controls, staging a holiday parade distraction, or riding mall displays up the escalators works wonderfully when the crew coordinates!'
      },
      {
        title: 'The Backup Generator Room',
        scenario: 'The stairwell exit is magnetically sealed without power! You are in the ankle-deep water of the basement maintenance room with a silent backup generator, a display riding lawnmower, and ominous scratching coming from the ceiling vent.',
        secrets: 'The riding lawnmower has a full tank and battery that can jump-start the generator or serve as an absurd getaway vehicle, while a confused zombie in the ceiling vent is about to drop in. Watch out for live wires in the puddle if teammates don\'t coordinate!'
      },
      {
        title: 'Evacuation on the Helipad',
        scenario: 'You burst onto the rooftop parking deck! A rescue chopper is circling overhead in the fog, while the roof is cluttered with shopping carts and a holiday fireworks display. Behind you, zombies are pounding on the stairwell door.',
        secrets: 'Combining shopping-cart barricades (or bowling!) with an over-the-top holiday fireworks show signals the rescue chopper and clears the landing pad in style!'
      }
    ]
  },
  {
    id: 'space-meltdown',
    title: 'SS Disaster: Orbital Meltdown',
    genre: 'Sci-Fi Chaos',
    description: 'Your bargain-budget deep space cargo ship has been struck by a micrometeorite, and the ship\'s AI is having an existential crisis.',
    rounds: [
      {
        title: 'Breach in the Mess Hall',
        scenario: 'Warning sirens blare! A hull breach the size of a basketball is pulling air and loose objects in the Mess Hall toward outer space. An emergency bulkhead panel sits on the far wall, and floating globules of hot soup fill the room.',
        secrets: 'The basketball-sized breach can be plugged with anything absurdly bulky in the Mess Hall while teammates human-chain, soup-surf, or tether their way to the emergency bulkhead button!'
      },
      {
        title: 'The Passive-Aggressive AI Core',
        scenario: 'The ship\'s AI, M.O.T.H.E.R., has locked the bridge doors and refuses to let anyone through. In the server room, holographic defense drones are powering up around her central vocal terminal while cooling pipes hiss along the walls.',
        secrets: 'M.O.T.H.E.R. is only throwing a tantrum because the crew forgot her birthday! Throwing an impromptu surprise party, serenading her, or pulling a coordinated tech-prank on her servers wins her over immediately.'
      },
      {
        title: 'The Hyperdrive Leak',
        scenario: 'The warp core chamber is experiencing wild gravity fluctuations—half the room has reversed gravity! A cracked plasma rod is glowing dangerously hot inside the open reactor housing beside a disposal chute and a floating maintenance locker.',
        secrets: 'The reversed-gravity ceiling and floating maintenance tools make for prime zero-G slapstick! Coordinating ceiling-walks, improvised tongs, or trick-shots into the disposal chute stabilizes the reactor.'
      },
      {
        title: 'Escape Pod Musical Chairs',
        scenario: 'The ship has 60 seconds until detonation! You reach the Escape Bay, where the main lifeboat sits behind rusted launch clamps, an alien tentacle is emerging from an open air duct, and the manual release lever is mounted on the far catwalk.',
        secrets: 'The alien tentacle is surprisingly ticklish or open to bribery, and teaming up to pop the rusted clamps while hitting the catwalk release lever launches the escape pod in a blaze of glory!'
      }
    ]
  },
  {
    id: 'petty-lich',
    title: 'Dungeon of Malakor the Dark',
    genre: 'Fantasy / D&D Adventure',
    description: 'A classic D&D dungeon crawl where your party battles through enemy hordes, lethal gothic hazards, and ridiculously over-the-top spiked armor to defeat Malakor the Dark, a brooding edgelord lich bent on apocalyptic doom.',
    rounds: [
      {
        title: 'The Spiked Iron Gates & The Skeleton Phalanx',
        scenario: 'You stand before the imposing obsidian gatehouse of the dungeon, flanked by jagged gargoyles and a moat of bubbling black tar. Guarding the drawbridge is a phalanx of skeletal warriors clad in comically over-the-top, spike-covered black armor, brandishing flaming obsidian halberds while a cursed skull speaker blares thunderous dark Gregorian chant rock across the ravine.',
        secrets: 'The skeletons are obsessed with looking dark and menacing, striking theatrical poses in time with their metal music. However, their armor is so excessively covered in curved spikes that bumping into each other gets them permanently hooked together like Velcro! Furthermore, they are deeply insecure about their "dark aesthetic" and easily flustered by dramatic metal poses or edgy compliments. Watch out for the tar moat—a well-timed shove can send an enemy, or an annoying party member, straight in!'
      },
      {
        title: 'The Hall of Chains & The Shadow Cultist Swarm',
        scenario: 'You breach the inner keep, entering a colossal gothic hall of towering obsidian pillars. Swinging spiked pendulums and heavy meat hooks sway from the ceiling, while an actual blood fountain churns ominously in the center of the room. A swarm of fanatical shadow cultists in oversized black leather trench coats and spiked iron masks chant edgelord battle hymns as they surge forward to overwhelm your party.',
        secrets: 'The cultists have zero peripheral vision inside their narrow-slit spiked iron masks and constantly trip over the hems of their heavy leather trench coats. Their fanaticism is rooted in edgelord angst: reciting darker, more brooding despair poetry or out-edging them with dramatic dark flair will completely transfix them or derail their battle hymns! The swinging pendulums follow a predictable arc that can be used to sweep cultists into the blood fountain—or knock a rival adventurer into harm\'s way.'
      },
      {
        title: 'The Obsidian Bridge & The Death Knight Legion',
        scenario: 'A cavernous abyss opens up before you, with a vast sea of glowing green hellfire churning hundreds of feet below. The only way forward is a narrow obsidian bridge with zero guardrails and brittle stone support pillars. Charging down the bridge toward you is the elite Death Knight Legion—hulking brutes clad in jagged, black-iron plate armor mounted atop skeletal warhorses, lowering heavy lances for a devastating cavalry charge.',
        secrets: 'This is a brutal, serious tactical test of survival. The Death Knights\' heavy charge has immense momentum; if their path is redirected, dodged, or braced with sudden barriers, their skeletal steeds will overshoot the narrow bridge and plunge into the green hellfire. However, the bridge has no railings, and falling into the hellfire below means instant, permanent death ("DEAD"). A callous adventurer can easily use the chaos to trip or shove a rival into the path of an oncoming lance or over the precipice!'
      },
      {
        title: 'Malakor the Dark\'s Throne Room',
        scenario: 'You burst into the grand throne room! Malakor the Dark floats menacingly above a throne carved from thousands of obsidian skulls, clad in spiked dark plate armor with six tattered black capes billowing dramatically. Spiked necrotic runes pulse with dark energy around him as he channels a massive apocalyptic doomsday spell, monologuing that "life is a dark abyss and none shall escape the eternal void!" On an altar behind him, his glowing bone phylactery sits unprotected.',
        secrets: 'Malakor\'s apocalyptic channel requires absolute brooding despair and grim concentration. His focus can be violently shattered in two ways: by shattering the floating spiked runes around him, or—hilariously—by improving his mood! Showering him with sincere compliments, positive thoughts, cheerful jokes, or joyful affirmations derails his edgelord angst, causing his doomsday spell energy to backfire catastrophically into him! Meanwhile, his phylactery on the altar holds his very soul: smashing it destroys the Lich forever, but a greedy party member can snatch it first to blackmail Malakor or claim his necromantic powers for themselves!'
      }
    ]
  }
];

/**
 * Palette of vibrant drawing colors for the HTML5 Character Sketchpad canvas.
 */
const DRAW_COLORS = [
  '#ffca28', // Cartoon Gold
  '#ff5252', // Cherry Red
  '#ff7043', // Neon Orange
  '#00e676', // Electric Green
  '#00e5ff', // Cyan / Aqua
  '#7c4dff', // Vivid Purple
  '#ec407a', // Hot Pink
  '#111426'  // Deep Ink Black
];
