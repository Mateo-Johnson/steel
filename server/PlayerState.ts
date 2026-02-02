// server/PlayerState.ts

// ================= TYPES =================

export type Stance = "low" | "mid" | "high";
export type AttackType = "light" | "heavy";
export type State =
  | "idle"
  | "dash"
  | "attack"
  | "block"
  | "hit"
  | "stunned"
  | "dead";

export type InputFrame = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  light: boolean;
  heavy: boolean;
  block: boolean;
  dash: boolean;
};

export type AttackPhase = "startup" | "active" | "recovery";

export type AttackState = {
  type: AttackType;
  stance: Stance;
  phase: AttackPhase;
  timer: number;
  hasHit: boolean;
};

// ================= CONSTANTS =================

const SPEED = 200;

const ATTACK_DATA = {
  light: {
    damage: 10,
    stamina: 10,
    startup: 0.12,
    active: 0.12,
    recovery: 0.1,
    cooldown: 0.35,
    hitstun: 0.15,
  },
  heavy: {
    damage: 20,
    stamina: 20,
    startup: 0.18,
    active: 0.18,
    recovery: 0.25,
    cooldown: 0.6,
    hitstun: 0.25,
  },
} as const;

// ================= PLAYER STATE =================

export class PlayerState {
  // ----- POSITION -----
  public x: number;
  public facing: -1 | 1 = 1;

  // ----- STATE -----
  public state: State = "idle";
  public stance: Stance = "mid";

  // ----- COMBAT -----
  public health = 20;
  public stamina = 40;
  public currentAttack: AttackState | null = null;

  // ----- TIMERS -----
  private attackCooldown = 0;
  private hitstun = 0;
  private stunTimer = 0;

  constructor(startX: number) {
    this.x = startX;
  }

  // ================= UPDATE =================

  update(dt: number, input: InputFrame) {
    if (this.state === "dead") return;

    this.updateTimers(dt);
    this.updateStance(input);

    if (this.state === "stunned") {
      if (this.stunTimer <= 0) this.state = "idle";
      return;
    }

    if (this.hitstun > 0) return;

    switch (this.state) {
      case "idle":
        this.handleMovement(dt, input);
        this.tryAttack(input);
        this.tryBlock(input);
        break;

      case "attack":
        this.updateAttack(dt);
        break;

      case "block":
        if (!input.block) this.state = "idle";
        break;
    }
  }

  // ================= MOVEMENT =================

  private handleMovement(dt: number, input: InputFrame) {
    if (input.left) {
      this.x -= SPEED * dt;
      this.facing = -1;
    }

    if (input.right) {
      this.x += SPEED * dt;
      this.facing = 1;
    }
  }

  // ================= ATTACK =================

  private tryAttack(input: InputFrame) {
    if (this.attackCooldown > 0) return;

    if (input.light) this.beginAttack("light");
    else if (input.heavy) this.beginAttack("heavy");
  }

  private beginAttack(type: AttackType) {
    const data = ATTACK_DATA[type];
    if (this.stamina < data.stamina) return;

    this.stamina -= data.stamina;
    this.state = "attack";
    this.attackCooldown = data.cooldown;

    this.currentAttack = {
      type,
      stance: this.stance,
      phase: "startup",
      timer: data.startup,
      hasHit: false,
    };
  }

  private updateAttack(dt: number) {
    if (!this.currentAttack) return;

    const atk = this.currentAttack;
    atk.timer -= dt;
    if (atk.timer > 0) return;

    const data = ATTACK_DATA[atk.type];

    if (atk.phase === "startup") {
      atk.phase = "active";
      atk.timer = data.active;
    } else if (atk.phase === "active") {
      atk.phase = "recovery";
      atk.timer = data.recovery;
    } else {
      this.currentAttack = null;
      this.state = "idle";
    }
  }

  // ================= BLOCK =================

  private tryBlock(input: InputFrame) {
    if (!input.block || this.stamina < 5) return;
    this.stamina -= 5;
    this.state = "block";
  }

  // ================= HIT RESOLUTION (SERVER) =================

  applyHit(from: PlayerState) {
    if (!from.currentAttack || from.currentAttack.hasHit) return;

    const data = ATTACK_DATA[from.currentAttack.type];
    from.currentAttack.hasHit = true;

    this.health -= data.damage;
    this.hitstun = data.hitstun;
    this.state = this.health <= 0 ? "dead" : "hit";

    if (this.health <= 0) {
      this.state = "dead";
    }
  }

  // ================= HELPERS =================

  updateFacing(opponentX: number) {
    // Only update facing when idle or in hitstun
    if (this.state === "idle" || this.hitstun > 0) {
      if (opponentX > this.x) {
        this.facing = 1;  // Face right
      } else if (opponentX < this.x) {
        this.facing = -1; // Face left
      }
    }
  }

  private updateStance(input: InputFrame) {
    if (input.up) this.stance = "high";
    else if (input.down) this.stance = "low";
    else this.stance = "mid";
  }

  private updateTimers(dt: number) {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.hitstun = Math.max(0, this.hitstun - dt);
    this.stunTimer = Math.max(0, this.stunTimer - dt);
  }

  // ================= SNAPSHOT =================

  snapshot() {
    return {
      x: this.x,
      facing: this.facing,
      state: this.state,
      stance: this.stance,
      health: this.health,
      stamina: this.stamina,
      attack: this.currentAttack ? {
        type: this.currentAttack.type,
        stance: this.currentAttack.stance,
        phase: this.currentAttack.phase, // ADD THIS
        hasHit: this.currentAttack.hasHit,
      } : null,
    };
  }
}