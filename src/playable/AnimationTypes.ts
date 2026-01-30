// animation/AnimationTypes.ts

export type Stance = "low" | "mid" | "high";

export type PlayerAnimState =
  | "idle"
  | "walk"
  | "dash"
  | "hit"
  | "stunned"
  | "dead"
  // Attack variations by type and stance
  | "attack_light_low"
  | "attack_light_mid"
  | "attack_light_high"
  | "attack_heavy_low"
  | "attack_heavy_mid"
  | "attack_heavy_high"
  // Block variations by stance
  | "block_low"
  | "block_mid"
  | "block_high";

export type PlayerTag = "p1" | "p2";
