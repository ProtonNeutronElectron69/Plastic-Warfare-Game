section('T57 v84: the AI encounter ledger');

/* What this pins, and why each claim is here rather than left to the trails:
   the trails prove the ledger CHANGED production, which is worth nothing on its
   own - a bug changes production too. These are the properties that make the
   change the one that was intended. */

/* ---------- A: shape, ownership and the constants ---------- */
{
  G = null; newGame(cfg('backyard', 'dm', 'normal', 'green', 1, 845001));
  const bot = G.players.find(p => p.ai);
  ok('T57.A a bot brain opens with an empty ledger over the five armour classes',
    !!bot.ai.enc && Object.keys(bot.ai.enc).sort().join(',') === 'air,heavy,inf,light,medium' &&
    Object.values(bot.ai.enc).every(v => v === 0));
  ok('T57.A a human seat has no brain and therefore no ledger', !G.human.ai);

  /* ENC_DECAY is derived from the AI cadence, not typed. A hand-written figure
     would drift silently the moment aiTick's every-18-ticks gate or the 30Hz step
     moved, and the half-life would quietly stop being ENC_HALF. */
  ok('T57.A the decay is derived from ENC_HALF and the aiTick cadence',
    Math.abs(ENC_DECAY - Math.pow(0.5, (18 / 30) / ENC_HALF)) < 1e-12);
  ok('T57.A ...and it is a decay, not a growth', ENC_DECAY > 0.99 && ENC_DECAY < 1);
  ok('T57.A the blend never hands the ledger the whole mix while a census exists',
    ENC_CAP > 0 && ENC_CAP < 1);
}

/* ---------- B: it records who actually hurt it, by armour class ---------- */
{
  G = null; newGame(cfg('backyard', 'dm', 'normal', 'green', 1, 845002));
  const bot = G.players.find(p => p.ai), foe = G.human;
  const victim = makeUnit('grunt', bot, 20, 20);
  const shooter = makeUnit('tank', foe, 21, 20);     // ARMOR_OF_A.tank === 'heavy'
  const before = bot.ai.enc.heavy;
  applyDmg(victim, 10, 'shell', shooter);
  ok('T57.B damage from a heavy hull lands on the heavy row',
    bot.ai.enc.heavy > before && bot.ai.enc.inf === 0 && bot.ai.enc.light === 0);

  /* the row is the ATTACKER's class, never the victim's - the whole point is
     what the bot is being hit BY, and the victim here is infantry */
  ok('T57.B ...and not on the victim\'s own class', armorOf(victim) === 'inf' && bot.ai.enc.inf === 0);

  const heavyWas = bot.ai.enc.heavy;
  const friend = makeUnit('grunt', bot, 22, 20);
  applyDmg(victim, 10, 'bullet', friend);
  ok('T57.B friendly fire is not intelligence: an allied attacker writes nothing',
    bot.ai.enc.heavy === heavyWas && bot.ai.enc.inf === 0);

  const b2 = bot.ai.enc.heavy;
  applyDmg(victim, 10, 'shell', null);               // hazards, burn ticks, map damage
  ok('T57.B damage with no attacker at all writes nothing', bot.ai.enc.heavy === b2);
}

/* ---------- C: it decays, on the AI tick ---------- */
{
  G = null; newGame(cfg('backyard', 'dm', 'normal', 'green', 1, 845003));
  const bot = G.players.find(p => p.ai);
  bot.ai.enc.inf = 1000;
  const t0 = bot.ai.enc.inf;
  for (let i = 0; i < 600; i++) update(DT);          // 20 sim-seconds
  const t1 = bot.ai.enc.inf;
  ok('T57.C a standing figure falls', t1 < t0 && t1 > 0);
  /* ~33 aiTicks in 20s at one per 18 ticks, so the fall should be close to the
     half-life curve rather than any decay at all */
  const want = t0 * Math.pow(ENC_DECAY, Math.floor(600 / 18));
  ok('T57.C ...at the rate ENC_HALF asks for', Math.abs(t1 - want) / want < 0.15);
}

/* ---------- D: the blend, which is the only thing production reads ---------- */
{
  G = null; newGame(cfg('backyard', 'dm', 'normal', 'green', 1, 845004));
  const bot = G.players.find(p => p.ai);
  bot.ai.grudge = null;                               // no live census at all
  const plain = aiFoeArmorMix(bot);
  ok('T57.D with no census and no evidence the v83 guess still stands',
    plain.inf === 1 && plain.heavy === 0);

  bot.ai.enc.heavy = ENC_FULL * 2;                    // nothing but tank fire, and plenty of it
  const learned = aiFoeArmorMix(bot);
  ok('T57.D evidence beats the guess outright when there is no census to weigh it against',
    learned.heavy === 1 && learned.inf === 0);

  /* and it is a BLEND, not a takeover, while a census exists: a live army the bot
     can see keeps a say no matter how lopsided the ledger gets */
  G = null; newGame(cfg('backyard', 'dm', 'normal', 'green', 1, 845005));
  const b2 = G.players.find(p => p.ai);
  b2.ai.grudge = G.human;
  makeUnit('grunt', G.human, 30, 30);
  b2.ai.enc.heavy = ENC_FULL * 50;                    // absurd evidence, to prove the cap holds
  const mixed = aiFoeArmorMix(b2);
  ok('T57.D a live census is never fully overridden', mixed.inf > 0 && mixed.heavy < 1);
  ok('T57.D ...and the ledger takes at most ENC_CAP of it',
    Math.abs(mixed.heavy - ENC_CAP) < 1e-9);
  ok('T57.D the mix still sums to 1', Math.abs(Object.values(mixed).reduce((a, v) => a + v, 0) - 1) < 1e-9);
}

/* ---------- E: it is sim state, so it is hashed and it survives a save ---------- */
{
  G = null; newGame(cfg('backyard', 'dm', 'normal', 'green', 1, 845006));
  const bot = G.players.find(p => p.ai);
  const h0 = hashState();
  bot.ai.enc.medium += 12.5;
  ok('T57.E the ledger is inside hashState', hashState() !== h0);

  const json = saveState();
  const want = { ...bot.ai.enc };
  G = null; newGame(cfg('backyard', 'dm', 'normal', 'green', 1, 845006));
  loadState(json);
  const back = G.players.find(p => p.ai).ai.enc;
  /* _encAi copies every key it does not special-case and loadState spreads the
     decoded brain straight back, so this needs no encoder of its own - but a bot
     that reloaded with amnesia would pick differently from the run the snapshot
     was cut from, and T3 would catch it three tables away. Pinned here instead. */
  ok('T57.E a snapshot carries it, class for class',
    Object.keys(want).every(k => back[k] === want[k]));
}
