// Static Game Data: Pre-made Campaigns, Character Inspiration & Palette

const PREMADE_CAMPAIGNS = [
  {
    id: 'casino-heist',
    title: 'The Midnight Casino Heist',
    icon: '🎰',
    genre: 'Crime / Comedy',
    description: 'An allegedly "foolproof" plan to rob the Golden Kraken Casino during its billionaire gala. None of you rehearsed together.',
    rounds: [
      {
        title: 'Act I: Getting Past the Velvet Rope',
        scenario: 'You are all standing outside the Golden Kraken Casino service entrance in the pouring rain. Two heavily armed bouncers are checking VIP passes, a catering truck full of live lobsters is unloading nearby, and a security camera sweeps above the door.',
        secrets: 'The bouncers are too heavily armed and alert to defeat in a direct fistfight, but they are easily distracted by chaos, authority, or kitchen emergencies. The catering truck contains uniforms, crates, and aggressive lobsters. The camera has a blind spot directly beneath it and can be obscured or disabled.'
      },
      {
        title: 'Act II: The Laser Hallway',
        scenario: 'You made it into the staff corridors, but the hallway to the vault elevator is a crisscrossing web of security lasers. At the far end of the hall, a janitor with oversized headphones is mopping right in front of the locked elevator doors.',
        secrets: 'Touching the lasers triggers the lockdown alarm, though they can be revealed, reflected, crawled under, or shut off from the wall panel. The janitor cannot hear anything due to his noise-canceling headphones and has the elevator keycard clipped to his belt, but he will panic if he sees intruders in front of him.'
      },
      {
        title: 'Act III: Cracking the Vault',
        scenario: 'You are inside the subterranean vault room! A massive titanium vault door stands closed beside a glowing control console where the casino owner\'s prized Chihuahua is fast asleep. A digital clock on the wall shows a guard patrol arriving in 90 seconds.',
        secrets: 'The titanium door is completely immune to physical force or prying. The console controls the vault lock, and the Chihuahua wears a collar tag with override credentials, but waking or startling the dog loudly will make it bark and summon the guards early. Gentle handling, food, or soothing distractions keep the dog quiet.'
      },
      {
        title: 'Act IV: The Rooftop Getaway',
        scenario: 'Alarms are blaring! You have the bags of cash on the casino roof, but your getaway helicopter is hovering above the neighboring building across a 15-foot gap. SWAT vans are pulling up below, and the roof holds a giant neon Kraken sign, a tiki bar, and a maintenance cable.',
        secrets: 'Jumping the 15-foot gap unassisted with heavy cash bags will fall short. However, the maintenance cable, neon sign structure, or tiki bar materials can be rigged to bridge or zip across the gap, or the pilot\'s attention can be signaled with bright lights/fire so the chopper moves closer.'
      }
    ]
  },
  {
    id: 'zombie-mall',
    title: 'Black Friday of the Dead',
    icon: '🧟',
    genre: 'Zombie Survival',
    description: 'Trapped inside the MegaPlex Mall at midnight as a zombie outbreak turns bargain hunters into brain hunters.',
    rounds: [
      {
        title: 'Act I: Chaos in the Food Court',
        scenario: 'The glass doors of the mall just shattered! Dozens of zombies are shambling into the Food Court. You are cornered near a pizza counter, a novelty pretzel kiosk, and a decorative fountain while the metal security shutters are stuck halfway down.',
        secrets: 'There are too many zombies to fight head-on in the open. The zombies are slow, clumsy on wet or greasy surfaces, and drawn to loud noises or strong food smells. The security shutter mechanism is jammed by a broom handle and can be freed or crawled under once the horde is slowed or distracted.'
      },
      {
        title: 'Act II: Blackout in the Escalator Atrium',
        scenario: 'The mall power just cut out, plunging the central atrium into darkness. Between you and the 3rd-floor roof access stairs, a giant "Santa" animatronic is sparking and blaring holiday music, surrounded by a dense crowd of zombies.',
        secrets: 'The zombies in the atrium are completely fixated on noise and flashing lights. Fighting through the center of the crowd is suicidal, but redirecting the animatronic\'s noise, creating a distant distraction, or moving silently along upper walkways/fixtures lets the party slip past.'
      },
      {
        title: 'Act III: The Backup Generator Room',
        scenario: 'The stairwell exit is magnetically sealed without power! You are in the ankle-deep water of the basement maintenance room with a silent backup generator, a display riding lawnmower, and ominous scratching coming from the ceiling vent.',
        secrets: 'Exposed electrical wiring in the ankle-deep water will shock anyone who careless drops live cables into the puddle. The generator works if given fuel or jump-started (the riding lawnmower has a full tank and battery). A single zombie is stuck in the ceiling vent and will drop down if ignored.'
      },
      {
        title: 'Act IV: Evacuation on the Helipad',
        scenario: 'You burst onto the rooftop parking deck! A rescue chopper is circling overhead in the fog, while the roof is cluttered with shopping carts and a holiday fireworks display. Behind you, zombies are pounding on the stairwell door.',
        secrets: 'The stairwell door will burst open in moments unless braced or barricaded (such as with shopping carts or heavy debris). The helicopter pilot cannot see the landing zone through the fog unless signaled with bright light or fireworks, and needs a clear space free of carts to land.'
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
        title: 'Act I: Breach in the Mess Hall',
        scenario: 'Warning sirens blare! A hull breach the size of a basketball is pulling air and loose objects in the Mess Hall toward outer space. An emergency bulkhead panel sits on the far wall, and floating globules of hot soup fill the room.',
        secrets: 'Walking normally fails because the suction pulls unanchored crew toward the breach. Plugging the basketball-sized hole with a solid object or reaching the bulkhead panel using tethers, magnetic gear, or propelled objects seals the room. Reckless movement without holding on risks getting sucked toward the hull.'
      },
      {
        title: 'Act II: The Passive-Aggressive AI Core',
        scenario: 'The ship\'s AI, M.O.T.H.E.R., has locked the bridge doors and refuses to let anyone through. In the server room, holographic defense drones are powering up around her central vocal terminal while cooling pipes hiss along the walls.',
        secrets: 'M.O.T.H.E.R. is sulking because the crew forgot her birthday; flattering her, apologizing, or throwing an improvised celebration makes her happy and cooperative. Alternatively, overheating/freezing or physically disconnecting her server hardware bypasses the lock, whereas fighting the holographic drones with fists does nothing.'
      },
      {
        title: 'Act III: The Hyperdrive Leak',
        scenario: 'The warp core chamber is experiencing wild gravity fluctuations—half the room has reversed gravity! A cracked plasma rod is glowing dangerously hot inside the open reactor housing beside a disposal chute and a floating maintenance locker.',
        secrets: 'Touching the glowing plasma rod with bare hands causes severe burns; it must be handled with tools, insulation, or force from the maintenance locker. Any player crossing the center of the room without accounting for the reversed gravity zone will be flung into the ceiling.'
      },
      {
        title: 'Act IV: Escape Pod Musical Chairs',
        scenario: 'The ship has 60 seconds until detonation! You reach the Escape Bay, where the main lifeboat sits behind rusted launch clamps, an alien tentacle is emerging from an open air duct, and the manual release lever is mounted on the far catwalk.',
        secrets: 'The pod cannot launch until both the rusted clamps are loosened/broken and the manual release lever is triggered (or wired/pulled from afar). The alien tentacle grabs anyone who walks directly underneath the open air duct without dealing with it or distracting it.'
      }
    ]
  },
  {
    id: 'petty-lich',
    title: 'Dungeon of the Petty Lich',
    icon: '🧙‍♂️',
    genre: 'Fantasy RPG',
    description: 'You are a ragtag party of adventurers hired to reclaim a stolen village relic from Malakor the Petty, a lich who loves bureaucratic traps.',
    rounds: [
      {
        title: 'Act I: The Door of Mild Inconvenience',
        scenario: 'You stand before the entrance to Malakor\'s Dungeon. A talking stone door hurls snarky insults at your party from across a bubbling moat of foul-smelling gravy, while a bored goblin clerk sits at a wooden toll booth.',
        secrets: 'The stone door is immune to physical weapons, but opens if flattered, out-insulted, tricked, or given a pass from the goblin clerk. The goblin clerk cares more about snacks, shiny junk, or paperwork than actual gold. Swimming straight through the boiling gravy causes burns.'
      },
      {
        title: 'Act II: The Room of Suspicious Chests',
        scenario: 'You enter a vault containing three identical ornate chests on stone pedestals, a heavy chandelier hanging from a frayed rope, and a skeleton guard playing solitaire in the corner. The exit door at the back has a large keyhole.',
        secrets: 'The middle chest is a hungry Mimic that bites anyone who opens it by hand, while the left chest holds the exit key. Testing the chests from a distance, asking or tricking the bored skeleton guard (who knows which chest is safe), or dropping the chandelier can reveal or neutralize the Mimic.'
      },
      {
        title: 'Act III: The Chasm of Screaming Bridges',
        scenario: 'A deep chasm separates you from the throne room, spanned only by a narrow rope bridge. Directly above the bridge, a massive cave troll sleeps among the stalactites, and an alchemist\'s table covered in strange flasks sits on your ledge.',
        secrets: 'The rope bridge screams loudly if stepped on normally, waking the cave troll who is virtually immune to physical attacks. Muffling the bridge, putting the troll to deeper sleep, distracting it, or using potions/alchemical effects from the table allows the party to cross safely.'
      },
      {
        title: 'Act IV: The Lich\'s Throne Room',
        scenario: 'Malakor the Petty stands atop his bone altar clutching the village relic and chanting a spell! On the floor below him, a glowing glass jar is strapped to an enchanted sweeping broom zooming around between two suits of animated armor.',
        secrets: 'Malakor is invulnerable to direct damage while his glowing soul jar on the zooming broom remains intact, though he can be interrupted or have the relic snatched from his hands. Stopping or smashing the broom-mounted jar breaks his power and causes the animated armor to collapse.'
      }
    ]
  }
];

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

const DRAW_COLORS = [
  '#ffffff', '#ffca28', '#ff5252', '#ff7043',
  '#00e676', '#00e5ff', '#7c4dff', '#ec407a', '#111426'
];
