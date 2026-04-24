import {
  Spell,
  ThunderballSpell,
  MultiTargetSpell,
  HealSpell,
  DOTSpell,
  AOESpell,
  BuffSpell,
} from "./spell.js";
import { Effect } from "./effect.js";

import {
  SlashEffect,
  IceSlashEffect,
  PoisonSlashEffect,
  ArcaneSlashEffect,
  LightningSlashEffect,
  DarkSlashEffect,
  HolySlashEffect,
  LightningBallVFX,
  TripleOrbVFX,
  HealBurstVFX,
  AOEExplosionVFX,
  PoisonCloudVFX,
  BuffGlowVFX,
} from "../utils/vfx.js";

export var SPELLS = {
  // ── Melee — default fire slash ────────────────────────────────────────────
  quickSwing: new Spell(
    "Quick Swing",
    [new Effect("damage", 2)],
    "fireballAnimation",
    SlashEffect,
    35,
  ),
  heavySwing: new Spell(
    "Heavy Swing",
    [new Effect("damage", 10)],
    "fireballAnimation",
    SlashEffect,
    45,
  ),

  // ── Melee — coloured variants ─────────────────────────────────────────────
  iceSwing: new Spell(
    "Ice Swing",
    [new Effect("damage", 6)],
    "fireballAnimation",
    IceSlashEffect,
    35,
  ),
  poisonSwing: new Spell(
    "Poison Swing",
    [new Effect("damage", 5)],
    "fireballAnimation",
    PoisonSlashEffect,
    35,
  ),
  arcaneSwing: new Spell(
    "Arcane Swing",
    [new Effect("damage", 8)],
    "fireballAnimation",
    ArcaneSlashEffect,
    40,
  ),
  lightningSwing: new Spell(
    "Lightning Swing",
    [new Effect("damage", 9)],
    "fireballAnimation",
    LightningSlashEffect,
    40,
  ),
  darkSwing: new Spell(
    "Dark Swing",
    [new Effect("damage", 12)],
    "fireballAnimation",
    DarkSlashEffect,
    45,
  ),
  holySwing: new Spell(
    "Holy Swing",
    [new Effect("damage", 8)],
    "fireballAnimation",
    HolySlashEffect,
    40,
  ),

  // ── Ranged projectile (legacy) ────────────────────────────────────────────
  fireball: new Spell(
    "Fireball",
    [new Effect("damage", 8)],
    "fireballAnimation",
    "fireballVFX",
    200,
  ),

  // ── Magic — Thunderball (hotkey 1) ────────────────────────────────────────
  // White-blush orb materialises above the tab-targeted enemy's head,
  // then a zigzag lightning bolt strikes down for 15 damage.
  thunderball: new ThunderballSpell(
    "Thunderball",
    [new Effect("damage", 15)],
    "fireballAnimation",
    LightningBallVFX,
    300,
  ),

  // ── Magic — Triple Orb (hotkey 2) ────────────────────────────────────────
  // Spinning torusKnot in front of caster splits into 3 colour-coded orbs
  // with trails; each flies to a random enemy within 1500 units for 8 dmg.
  tripleOrb: new MultiTargetSpell(
    "Triple Orb",
    [new Effect("damage", 8)],
    "fireballAnimation",
    TripleOrbVFX,
    1500,
    3,
  ),

  // ── Heal — Target Heal (hotkey 3) ────────────────────────────────────────
  // Mirrors FRESH GRUDGE's TargetHealSkill: instant HP restore + green burst
  healTouch: new HealSpell(
    "Heal Touch",
    [new Effect("heal", 25)],
    "castAnimation",
    HealBurstVFX,
    350,
  ),

  // ── Heal over time — Regeneration (hotkey 4) ─────────────────────────────
  // Mirrors FRESH GRUDGE's BuffSkillEffect: gold aura + 5 hp/s for 5 s
  regeneration: new BuffSpell(
    "Regeneration",
    [new Effect("hot", 5, 5000)],
    "castAnimation",
    BuffGlowVFX,
    350,
    5000, // buff duration shown to VFX
  ),

  // ── DOT — Poison Strike (poison melee) ───────────────────────────────────
  // Mirrors FRESH GRUDGE's ProjectileSkillEffect with DoT twist
  poisonStrike: new DOTSpell(
    "Poison Strike",
    [new Effect("damage", 4), new Effect("dot", 3, 4000)],
    "fireballAnimation",
    PoisonSlashEffect,
    PoisonCloudVFX,
    35,
    4000,
  ),

  // ── AOE — Ground Slam (hotkey 5) ─────────────────────────────────────────
  // Mirrors FRESH GRUDGE's AreaBuffSkill / AreaHealSkill radius pattern
  groundSlam: new AOESpell(
    "Ground Slam",
    [new Effect("damage", 18)],
    "castAnimation",
    AOEExplosionVFX,
    600, // AOE radius in scene units
  ),

  // ── AOE — Blizzard (hotkey 6) ─────────────────────────────────────────────
  // Ice AOE with slow — multi-target + slow effect
  blizzard: new AOESpell(
    "Blizzard",
    [new Effect("damage", 10), new Effect("slow", 0.5, 3000)],
    "castAnimation",
    AOEExplosionVFX,
    500,
  ),
};
