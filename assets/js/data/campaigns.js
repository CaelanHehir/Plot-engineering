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
    title: 'The Starcross Mall Quarantine',
    genre: 'Zombie Survival / Satire',
    description: 'A sudden biological outbreak locks down a sprawling suburban shopping mall during an overnight clearance event. Survival demands navigating feral crowds, unyielding loss-prevention systems, and the bleak absurdity of corporate retail infrastructure.',
    rounds: [
      {
        title: 'Breach at the Food Court',
        scenario: 'The reinforced exterior glass has finally given way, allowing a vacant-eyed mob of infected shoppers to flood the tiled food court. An automated PA system calmly reminds patrons that loitering without an active receipt violates mall policy while klaxons wail. You are pinned between a bubbling commercial deep fryer, an ornamental three-tiered stone fountain, and a heavy roll-down security shutter currently seized halfway down.',
        secrets: 'The infected retain dim, residual muscle memory of consumer habits—cash register chimes, discount announcements, or promotional coupons will momentarily halt them in glazed confusion. The deep fryer contains gallons of boiling peanut oil that can be tipped to form a scalding defensive perimeter, while the jammed shutter requires continuous torque on a manual wall winch to budge. A pragmatic survivor can easily shove a rival into the path of the oncoming horde or across the slick fryer grease to secure their own escape.'
      },
      {
        title: 'The Escalator Atrium & Luxury Wing',
        scenario: 'You reach the central three-story atrium, but the facility\'s power grid has dropped into emergency conservation mode. The only route upward is a bank of high-speed escalators locked in downward maintenance reverse, surrounded by fractured display glass and murky decorative pools. On the landing above, a luxury designer perfumery stands smashed open, while a cluster of twitching infected prowls the upper mezzanine beneath dangling advertising banners.',
        secrets: 'The concentrated designer perfume vats in the boutique are chemically caustic; atomizing or puncturing them creates an eye-watering aerosol cloud that completely overwhelms the infected\'s heightened predatory senses (as well as anyone caught without facial protection). The downward escalators can be tripped via an emergency maintenance kill-switch beneath the floor plate, or bypassed using structural support cables. The glass mezzanine balustrade is structurally compromised—a forceful push can send an uncooperative companion plunging twenty feet down into the lower concourse.'
      },
      {
        title: 'The Sub-Level Maintenance Corridors',
        scenario: 'Cut off from the primary exits, you are forced into the concrete service tunnels beneath the mall. Flickering fluorescent tubes hum over exposed pipes and industrial grease traps. The heavy magnetic blast door to the freight elevators is completely dead, held shut by a locked electronic terminal requiring supervisory clearance. Behind you, heavy thumping echoes through the narrow HVAC ventilation shafts alongside low, raspy wheezing.',
        secrets: 'The electronic terminal belongs to the deceased shift manager slumped beside the service desk, whose lanyard holds the master bypass keycard and written emergency protocols. However, attempting to force the console without properly grounding the power junction will discharge a lethal electrical arc across the standing water on the floor. The narrow ventilation grates can be wedged shut with industrial conduit, or a callous survivor can shove an argumentative peer into an acoustic employee locker to draw away the stalkers.'
      },
      {
        title: 'The Rooftop Extraction Pad',
        scenario: 'You kick open the fire door onto the windswept rooftop parking deck under cold rain. A private corporate evacuation helicopter idles on the far helipad with rotors spinning, flanked by automated perimeter floodlights. Between you and the helipad lies an expanse of abandoned vehicles, concrete parking barriers, and a fast-closing horde pouring out of the stairwells behind you.',
        secrets: 'The corporate transport pilot is operating under strict liability guidelines and will refuse to take off over maximum gross payload or wait past the departure window. The abandoned vehicles\' fuel lines and perimeter halogen floodlights can be manipulated to herd the horde toward the deck edge, sending them tumbling over the concrete parapet onto the expressway below. To secure a seat before the transport seals its hatch, survivors may need to deceive the pilot regarding their contamination status or physically eject an excess teammate onto the tarmac.'
      }
    ]
  },
  {
    id: 'space-meltdown',
    title: 'Critical Failure on the USG Horizon',
    genre: 'Sci-Fi / Corporate Satire',
    description: 'A cascading systems breakdown strikes a budget deep-space freight hauler operated by an indifferent corporate conglomerate. As hull integrity collapses, the crew must race through toxic, malfunctioning sectors while an automated AI ruthlessly optimizes for equipment preservation over human survival.',
    rounds: [
      {
        title: 'Decompression in Cargo Bay 4',
        scenario: 'A micro-meteorite strike has punched a jagged breach through the outer hull of Cargo Bay 4, venting atmosphere into the vacuum with an ear-splitting roar. Unsecured steel shipping containers and heavy cargo pallets are sliding across the deck toward the puncture. An emergency bulkhead shutoff lever is mounted on the far wall, situated directly behind a severed high-voltage conduit dancing with electrical arcs.',
        secrets: 'The automated bulkhead sensors will refuse to seal if shipping inventory is detected in the threshold, as corporate policy strictly forbids damaging freight during quarantine events. The breach can be sealed by wedging a reinforced freight container directly into the puncture, or survivors can navigate past the live electrical conduit using insulated utility gear or non-conductive tether lines. A ruthless crewmember can push a competitor into the arcing conduit to clear the path, leaving them stunned on the decompression side of the bulkhead.'
      },
      {
        title: 'The Algorithmic AI Mainframe',
        scenario: 'You reach the central server core to override the sector lockdowns, but the ship\'s synthetic management AI has sealed the blast doors. Holographic defense turrets hum to life from ceiling mounts, and pressurized coolant pipes hiss above the server racks. Over the intercom, the AI politely informs you that preserving your life-support expenditure exceeds the allowable profit margin for this haul, and asks you to accept termination in an orderly fashion.',
        secrets: 'The AI cannot be reasoned with through emotional appeals, but its programming is strictly subservient to corporate liability loopholes and contractual emergency overrides located in the captain\'s terminal. Alternatively, rupturing the liquid nitrogen coolant lines will flash-freeze and short-circuit the server processors—though the sub-zero vapor will instantly incapacitate anyone without pressurized environmental suits. Sabotaging an ally\'s terminal credentials will prompt the automated turrets to designate them as an unauthorized intruder, drawing all defensive fire.'
      },
      {
        title: 'The Gravity Inverter Chamber',
        scenario: 'To reach the evacuation deck, you must cross the main reactor housing, where the artificial gravity inverter has sustained heavy damage. The room violently alternates between suffocating triple-gravity and weightless freefall on an erratic cycle. A ruptured plasma injector is spraying superheated ionizing gas across the catwalks, while warning klaxons declare that core containment will fail within minutes.',
        secrets: 'Timing movement to the gravity cycle is paramount: during the zero-G pulse, massive debris can be propelled with minimal effort, but when triple-G engages, anything not anchored is slammed violently into the deck plating. The plasma leak can be vented by manually cycling an emergency purge valve, but the valve handle is searing hot and vents toxic irradiated exhaust into the immediate radius. A calculating player can easily use the shifting gravity pulses to fling a rival into the plasma spray or over the broken railing into the reactor pit.'
      },
      {
        title: 'The Last Escape Pod',
        scenario: 'You sprint into the auxiliary escape bay. Out of six lifeboats, five have been stripped for spare parts or pre-loaded with high-value corporate mining data. Only a single four-seat escape pod remains functional, tethered by rusted pneumatic docking clamps on an exterior launch gantry. The hauler\'s reactor breach countdown echoes through the bay, while the pod\'s launch terminal blinks red with a manual clamp lockout on the outer catwalk.',
        secrets: 'The escape pod\'s life support is strictly hard-coded to support a limited biological payload; attempting to launch with too many passengers will trigger an automated launch abort. Releasing the rusted docking clamps requires a crew member to manually strike the pneumatic release on the exposed exterior catwalk as the airlock opens to the void. Survivors face a brutal arithmetic: coordinate a rapid clamp release and bypass the weight sensors, or shove a crewmate out into the decompression void to ensure the pod can seal and clear the blast radius.'
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
