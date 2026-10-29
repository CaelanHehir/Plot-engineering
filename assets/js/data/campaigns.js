/**
 * Static Game Data for Plot Engineering
 * 
 * Contains:
 * 1. PREMADE_CAMPAIGNS: Curated multi-round comedic storylines with player-facing
 *    scenarios and judge-only comedic hooks/secrets.
 * 2. RANDOM_CHARACTERS: Sample character templates with starter perks used for
 *    AI bot players and auto-ready fallbacks when players run out of time.
 * 3. DRAW_COLORS: Vibrant cartoon color palette for the drawing canvas sketchpad.
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
    title: 'The Midnight Casino Heist',
    icon: '🎰',
    genre: 'Crime / Comedy',
    description: 'An allegedly "foolproof" plan to rob the Golden Kraken Casino during its billionaire gala. None of you rehearsed together.',
    rounds: [
      {
        title: 'Getting Past the Velvet Rope',
        scenario: 'You are all standing outside the Golden Kraken Casino service entrance in the pouring rain. Two heavily armed bouncers are checking VIP passes, a catering truck full of live lobsters is unloading nearby, and a security camera sweeps above the door.',
        secrets: 'The bouncers are gullible aspiring actors who are easily impressed by absurd VIP personas, culinary drama, or coordinated lobster chaos. The catering truck is packed with chef outfits, rolling carts, and feisty lobsters. Any funny or coordinated plan using disguises, distractions, or the lobsters works great!'
      },
      {
        title: 'The Laser Hallway',
        scenario: 'You made it into the staff corridors, but the hallway to the vault elevator is a crisscrossing web of security lasers. At the far end of the hall, a janitor with oversized headphones is mopping right in front of the locked elevator doors.',
        secrets: 'The janitor is completely lost in his smooth-jazz playlist and has the elevator keycard clipped to his belt. Coordinated acrobatics, reflective props, comedic slapstick sliding on the wet floor, or teaming up to charm/distract the janitor will get the crew into the elevator!'
      },
      {
        title: 'Cracking the Vault',
        scenario: 'You are inside the subterranean vault room! A massive titanium vault door stands closed beside a glowing control console where the casino owner\'s prized Chihuahua is fast asleep. A digital clock on the wall shows a guard patrol arriving in 90 seconds.',
        secrets: 'The spoiled Chihuahua wears a diamond collar with the vault override tag and loves gourmet treats, belly rubs, or absurd lullabies. Coordinated teamwork to pamper/entertain the dog while working the console—or an over-the-top cartoon heist stunt—pops the vault right open!'
      },
      {
        title: 'The Rooftop Getaway',
        scenario: 'Alarms are blaring! You have the bags of cash on the casino roof, but your getaway helicopter is hovering above the neighboring building across a 15-foot gap. SWAT vans are pulling up below, and the roof holds a giant neon Kraken sign, a tiki bar, and a maintenance cable.',
        secrets: 'The maintenance cable, giant neon Kraken tentacles, and tiki bar umbrellas/blenders can be combined into hilarious improvised zip-lines, catapults, or flashy signals to bring the getaway chopper right to the crew!'
      }
    ]
  },
  {
    id: 'zombie-mall',
    title: 'Black Friday of the Dead',
    icon: '🧟',
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
    icon: '🚀',
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
    title: 'Dungeon of the Petty Lich',
    icon: '🧙‍♂️',
    genre: 'Fantasy Comedy',
    description: 'You are a ragtag party of adventurers hired to reclaim a stolen village relic from Malakor the Petty, a lich who loves bureaucratic traps.',
    rounds: [
      {
        title: 'The Door of Mild Inconvenience',
        scenario: 'You stand before the entrance to Malakor\'s Dungeon. A talking stone door hurls snarky insults at your party from across a bubbling moat of foul-smelling gravy, while a bored goblin clerk sits at a wooden toll booth.',
        secrets: 'The talking door is a drama queen that loves roast battles, absurd compliments, or theatrical performances, and the bored goblin clerk will stamp anything in exchange for snacks, gossip, or a good laugh!'
      },
      {
        title: 'The Room of Suspicious Chests',
        scenario: 'You enter a vault containing three identical ornate chests on stone pedestals, a heavy chandelier hanging from a frayed rope, and a skeleton guard playing solitaire in the corner. The exit door at the back has a large keyhole.',
        secrets: 'The middle chest is a dramatic Mimic with a sweet tooth, the left chest holds the exit key, and the skeleton guard is dying for someone to help him win his solitaire game or pull a prank on the Mimic!'
      },
      {
        title: 'The Chasm of Screaming Bridges',
        scenario: 'A deep chasm separates you from the throne room, spanned only by a narrow rope bridge. Directly above the bridge, a massive cave troll sleeps among the stalactites, and an alchemist\'s table covered in strange flasks sits on your ledge.',
        secrets: 'The rope bridge gossips loudly when stepped on unless muffled or sweet-talked, and the alchemist\'s table has wacky potions (feather-fall, giant-bounce, lullaby mist) that pair hilariously with coordinated team stunts!'
      },
      {
        title: 'The Lich\'s Throne Room',
        scenario: 'Malakor the Petty stands atop his bone altar clutching the village relic and chanting a spell! On the floor below him, a glowing glass jar is strapped to an enchanted sweeping broom zooming around between two suits of animated armor.',
        secrets: 'Malakor\'s dramatic monologue is easily derailed by heckling or stage antics, while wrangling the zooming broom-jar or tricking the clunky animated armor into colliding wins the relic and saves the village!'
      }
    ]
  }
];

/**
 * Character archetypes with starting perks.
 * Used for:
 * 1. Simulating AI Bot teammates when playing with fewer than 3 human players.
 * 2. Auto-filling character roles and quirks when players fail to submit before the timer expires.
 */
const RANDOM_CHARACTERS = [
  { name: 'Barnaby Slick', role: 'Disgraced Escape Artist who is allergic to ropes', startMod: { name: 'Trick Sleeve', type: 'buff', metaEffect: 'NONE', description: 'Produces small stage props at will' } },
  { name: 'Dr. Mildred Spark', role: 'Over-caffeinated Mad Scientist with zero spatial awareness', startMod: { name: 'Unstable Taser', type: 'buff', metaEffect: 'NONE', description: 'Can zap machinery or enemies once' } },
  { name: 'Officer Brick', role: 'Former Mall Security Guard taking this way too seriously', startMod: { name: 'Heavy Flashlight', type: 'buff', metaEffect: 'NONE', description: 'Illuminates dark rooms or bonks heads' } },
  { name: 'Gizmo the Raccoon', role: 'Three raccoons in a trench coat pretending to be a consultant', startMod: { name: 'Tiny Paws', type: 'neutral', metaEffect: 'NONE', description: 'Great at picking pockets, terrible at reaching high shelves' } },
  { name: 'Chef Gusto', role: 'Furious Sous-Chef armed with cast-iron cookware', startMod: { name: 'Cast-Iron Skillet', type: 'buff', metaEffect: 'NONE', description: 'Blocks projectiles and makes great omelets' } },
  { name: 'Vlad the Intern', role: '400-year-old Vampire doing an unpaid internship', startMod: { name: 'Sunlight Allergy', type: 'debuff', metaEffect: 'NONE', description: 'Weakened by bright lights or lasers' } },
  { name: 'Captain Bolt', role: 'Retired Stunt Double with questionable knees', startMod: { name: 'Creaky Left Knee', type: 'debuff', metaEffect: 'NONE', description: 'Makes a loud pop when sneaking' } },
  { name: 'Zara Zero', role: 'Conspiracy Podcaster livestreaming the entire crisis', startMod: { name: 'Selfie Stick', type: 'buff', metaEffect: 'NONE', description: 'Can peek around corners or poke buttons from 4 feet away' } }
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
