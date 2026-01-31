// animation/AnimationTypes.ts

export type Stance = "low" | "mid" | "high";

/**
 * Idle animation states based on stamina boxes (0–8)
 */
export type IdleStaminaState =
  | "idle_8"
  | "idle_7"
  | "idle_6"
  | "idle_5"
  | "idle_4"
  | "idle_3"
  | "idle_2"
  | "idle_1"
  | "idle_0";

/**
 * Walk animation states based on stamina boxes (0–8)
 */
export type WalkStaminaState =
  | "walk_8"
  | "walk_7"
  | "walk_6"
  | "walk_5"
  | "walk_4"
  | "walk_3"
  | "walk_2"
  | "walk_1"
  | "walk_0";

/**
 * All possible player animation states
 */
export type PlayerAnimState =
  // Idle / Walk (stamina-based)
  | IdleStaminaState
  | WalkStaminaState

  // Movement / general
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
