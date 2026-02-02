import Phaser from "phaser";

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

export type AttackData = {
  id: number;
  owner: Player;
  type: AttackType;
  stance: Stance;
  damage: number;
  hitstun: number;
  knockback: number;
  hasHit: boolean;
  canDashCancel: boolean;
  canAttackCancel: boolean;
};

interface InputMap {
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  keys: any;
}

export default class Player {
  private static ATTACK_ID = 0;

  private readonly LEVEL_OFFSET: Record<Stance, number> = {
    low: 40,   
    mid: 60,
    high: 80,
  };

  // ===== CORE =====
  private scene: Phaser.Scene;
  public sprite: Phaser.GameObjects.Sprite;
  public opponent!: Player;
  private groundY: number;

  // ===== STATE =====
  private state: State = "idle";
  public attackPhase: AttackPhase = "startup";
  private facing: -1 | 1 = 1;

  // ===== MOTION =====
  private velocityX = 0;
  private velocityY = 0;

  // ===== TIMERS =====
  private dashTimer = 0;
  private dashCooldown = 0;
  private blockTimer = 0;
  private blockCooldown = 0;
  private lastBlockTime = 0;
  private stunTimer = 0;
  private attackTimer = 0;
  private attackCooldown = 0;
  private hitstop = 0;
  private hitstun = 0;

  // ===== COMBAT =====
  private currentAttack?: AttackData;
  private health = 20;

  // ===== STANCE =====
  public stance: Stance = "mid";
  public attackStance: Stance = "mid";

  // ===== HITBOXES =====
  public attackHitbox: Phaser.GameObjects.Rectangle;
  public blockHitbox: Phaser.GameObjects.Rectangle;
  public hurtbox: Phaser.GameObjects.Rectangle;
  public hurtboxLow: Phaser.GameObjects.Rectangle;
  public hurtboxMid: Phaser.GameObjects.Rectangle;
  public hurtboxHigh: Phaser.GameObjects.Rectangle;

  // ===== STAMINA =====
  private stamina = 40;
  public readonly maxStamina = 40;
  private staminaBlocks: Phaser.GameObjects.Rectangle[] = [];
  private readonly STAMINA_UNIT = 5;

  // ===== CONSTANTS =====
  private readonly SPEED = 200;
  private readonly GRAVITY = 100;
  private readonly FORWARD_DASH_SPEED = 1500;
  private readonly BACK_DASH_SPEED = 700;
  private readonly DASH_COOLDOWN = 0.5;
  private readonly BLOCK_TIME = 0.4;
  private readonly BLOCK_COOLDOWN = 0.3;
  private readonly PERFECT_BLOCK_WINDOW = 0.18;

  public input!: InputMap;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    tag: "p1" | "p2",
    groundY: number,
  ) {
    this.scene = scene;
    this.groundY = groundY;

    // VISUAL ONLY
    this.sprite = scene.add.sprite(x, y, "player", 0).setOrigin(0.5, 1);

    if (tag === "p1") this.sprite.setScale(0.85);

    // HURTBOX
    const hurtboxWidth =
      tag === "p1" ? this.sprite.displayWidth * 0.9 : this.sprite.displayWidth;
    const hurtboxHeight =
      tag === "p1" ? this.sprite.displayHeight * 0.9 : this.sprite.displayHeight;
    this.hurtbox = scene.add
      .rectangle(
        this.sprite.x,
        this.sprite.y - this.sprite.displayHeight / 2,
        hurtboxWidth,
        hurtboxHeight,
        0xff0000,
        0.2,
      )
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    this.hurtboxLow = scene.add.rectangle(
      this.sprite.x,
      this.getLevelY("low"),
      30,
      20,
      0xff0000,
      0.2
    ).setOrigin(0.5).setVisible(false);

    this.hurtboxMid = scene.add.rectangle(
      this.sprite.x,
      this.getLevelY("mid"),
      30,
      20,
      0xff0000,
      0.2
    ).setOrigin(0.5).setVisible(false);

    this.hurtboxHigh = scene.add.rectangle(
      this.sprite.x,
      this.getLevelY("high"),
      30,
      20,
      0xff0000,
      0.2
    ).setOrigin(0.5).setVisible(false);


    // HITBOXES
    this.attackHitbox = scene.add.rectangle(0, 0, 60, 20, 0xffff00).setVisible(false);
    this.blockHitbox = scene.add
      .rectangle(0, 0, 40, this.sprite.displayHeight / 3, 0x00ff00)
      .setOrigin(0.5, 1)
      .setVisible(false);

    // INPUT
    if (tag === "p1") {
      this.input = {
        cursors: scene.input.keyboard!.createCursorKeys(),
        keys: scene.input.keyboard!.addKeys({
          light: Phaser.Input.Keyboard.KeyCodes.Z,
          heavy: Phaser.Input.Keyboard.KeyCodes.X,
          block: Phaser.Input.Keyboard.KeyCodes.SPACE,
          dash: Phaser.Input.Keyboard.KeyCodes.F,
        }),
      };
      this.createStaminaUI(20, 40);
    } else {
      this.input = {
        cursors: {
          up: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
          down: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
          left: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
          right: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        } as Phaser.Types.Input.Keyboard.CursorKeys,
        keys: scene.input.keyboard!.addKeys({
          light: Phaser.Input.Keyboard.KeyCodes.J,
          heavy: Phaser.Input.Keyboard.KeyCodes.K,
          block: Phaser.Input.Keyboard.KeyCodes.L,
          dash: Phaser.Input.Keyboard.KeyCodes.I,
        }),
      };
      this.createStaminaUI(600, 20);
    }
  }

  // ================= UPDATE =================

   update(dt: number, input: InputFrame) {
    if (this.state === "dead") return;

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    this.updateTimers(dt);
    this.updatePhysics(dt);
    this.updateStance(input);
    this.updateStaminaUI();
    this.resolvePlayerPush();

    this.hurtboxLow.x = this.sprite.x;
    this.hurtboxMid.x = this.sprite.x;
    this.hurtboxHigh.x = this.sprite.x;

    if (this.state === "stunned") {
      if (this.stunTimer <= 0) this.state = "idle";
      return;
    }

    if (this.hitstun > 0) return;
    if (this.state === "hit") this.state = "idle";

    switch (this.state) {
      case "idle":
        this.handleMovement(dt, input);
        this.tryDash(input);
        this.tryAttack(input);
        this.tryBlock(input);
        break;

      case "dash":
        if (this.dashTimer <= 0) {
          this.state = "idle";
          this.velocityX = 0;
        }
        break;

      case "attack":
        this.updateAttack();
        break;

      case "block":
        this.updateBlockHitbox();
        if (this.blockTimer <= 0) {
          this.state = "idle";
          this.blockHitbox.setVisible(false);
        }
        break;
    }

    this.hurtbox.x = this.sprite.x;
    this.hurtbox.y = this.sprite.y - this.sprite.displayHeight / 2;
  }

  // ================= MOTION =================

  private updatePhysics(dt: number) {
    this.velocityY += this.GRAVITY * dt;
    this.sprite.x += this.velocityX * dt;
    this.sprite.y += this.velocityY;
    this.velocityX *= 0.85;
    this.sprite.setFlipX(this.facing === -1);

    if (this.sprite.y >= this.groundY) {
      this.sprite.y = this.groundY;
      this.velocityY = 0;
    }
  }

  private isMoving = false;
  private handleMovement(dt: number, input: InputFrame) {
    this.isMoving = false;

    if (input.left) {
      this.sprite.x -= this.SPEED * dt;
      this.facing = -1;
      this.isMoving = true;
    }

    if (input.right) {
      this.sprite.x += this.SPEED * dt;
      this.facing = 1;
      this.isMoving = true;
    }
  }


  getIsMoving() {
    return this.isMoving;
  }

  // ================= DASH =================

  private tryDash(input: InputFrame) {
    if (!input.dash) return;

    if (this.state === "idle" && this.dashCooldown <= 0) {
      this.startDash();
    }

    if (
      this.state === "attack" &&
      this.attackPhase === "recovery" &&
      this.currentAttack?.canDashCancel &&
      this.stamina >= 5
    ) {
      this.spendStamina(5);
      this.currentAttack = undefined;
      this.startDash();
    }
  }


  private startDash() {
    const towardOpponent =
      (this.opponent.sprite.x > this.sprite.x ? 1 : -1) === this.facing;

    this.state = "dash";
    this.dashCooldown = this.DASH_COOLDOWN;
    this.dashTimer = towardOpponent ? 0.12 : 0.08;
    this.velocityX =
      (towardOpponent ? this.FORWARD_DASH_SPEED : this.BACK_DASH_SPEED) * this.facing;
  }

  // ================= ATTACK =================

  private tryAttack(input: InputFrame) {
    if (this.attackCooldown > 0) return;

    if (input.light && this.stamina >= 10) {
      this.spendStamina(10);
      this.beginAttack("light");
    }

    if (input.heavy && this.stamina >= 20) {
      this.spendStamina(20);
      this.beginAttack("heavy");
    }
  }

  private beginAttack(type: AttackType) {
    this.state = "attack";
    this.attackPhase = "startup";
    this.attackStance = this.stance;

    this.currentAttack = {
      id: Player.ATTACK_ID++,
      owner: this,
      type,
      stance: this.attackStance,
      damage: type === "light" ? 10 : 20,
      hitstun: type === "light" ? 0.15 : 0.25,
      knockback: type === "light" ? 160 : 260,
      hasHit: false,

      canDashCancel: type === "light",
      canAttackCancel: type === "light",
    };

    this.attackTimer = type === "light" ? 0.12 : 0.18;
    this.attackCooldown = type === "light" ? 0.35 : 0.6;
  }


  private updateAttack() {
    if (this.attackTimer > 0) return;

    if (this.attackPhase === "startup") {
      this.attackPhase = "active";
      this.attackTimer = this.currentAttack!.type === "light" ? 0.12 : 0.18;
      this.attackHitbox.setVisible(true);
    } else if (this.attackPhase === "active") {
      this.attackPhase = "recovery";
      this.attackTimer = this.currentAttack!.type === "light" ? 0.1 : 0.25;
      this.attackHitbox.setVisible(false);
    } else {
      this.state = "idle";
      this.currentAttack = undefined;
    }

    this.updateAttackHitbox();
  }

  // ================= BLOCK =================

  private tryBlock(input: InputFrame) {
    if (!input.block) return;
    if (this.blockCooldown > 0) return;
    if (this.stamina < 5) return;

    this.spendStamina(5);
    this.state = "block";
    this.blockTimer = this.BLOCK_TIME;
    this.lastBlockTime = this.PERFECT_BLOCK_WINDOW;
    this.blockCooldown = this.BLOCK_COOLDOWN;
    this.blockHitbox.setVisible(true);
  }

  // ================= CLASH =================

  public isAttackActive(): boolean {
    return this.state === "attack" && this.attackPhase === "active";
  }

  public resolveClash(opponent: Player) {
    // cancel attacks
    this.state = "idle";
    opponent.state = "idle";
    this.attackPhase = "recovery";
    opponent.attackPhase = "recovery";
    this.currentAttack = undefined;
    opponent.currentAttack = undefined;
    this.attackHitbox.setVisible(false);
    opponent.attackHitbox.setVisible(false);

    // push apart
    const dir = this.sprite.x < opponent.sprite.x ? -1 : 1;
    const CLASH_PUSH = 120;
    this.velocityX = dir * CLASH_PUSH;
    opponent.velocityX = -dir * CLASH_PUSH;

    // stamina penalty
    this.spendStamina(5);
    opponent.spendStamina(5);

    // hitstop
    this.hitstop = 0.05;
    opponent.hitstop = 0.05;
  }

  // ================= COLLISION / COMBAT =================

  public resolveIncomingAttack(attack: AttackData) {
    const blocking = this.state === "block";
    let hitboxMatch = false;

    // determine which hurtbox to check
    switch (attack.stance) {
      case "low":
        hitboxMatch = Phaser.Geom.Intersects.RectangleToRectangle(
          attack.owner.attackHitbox.getBounds(),
          this.hurtboxLow.getBounds()
        );
        break;
      case "mid":
        hitboxMatch = Phaser.Geom.Intersects.RectangleToRectangle(
          attack.owner.attackHitbox.getBounds(),
          this.hurtboxMid.getBounds()
        );
        break;
      case "high":
        hitboxMatch = Phaser.Geom.Intersects.RectangleToRectangle(
          attack.owner.attackHitbox.getBounds(),
          this.hurtboxHigh.getBounds()
        );
        break;
    }

    const perfect = blocking && this.lastBlockTime > 0;

    if (perfect) {
      this.hitstop = 0.06;
      this.state = "idle";
      this.gainStamina(5);
      return;
    }

    if (blocking && hitboxMatch && attack.type === "heavy") {
      this.state = "stunned";
      this.stunTimer = 1;
      return;
    }

    if (blocking && hitboxMatch) {
      this.hitstun = 0.1;
      this.hitstop = 0.04;
      return;
    }

    if (!hitboxMatch) return; // attack misses entirely

    this.health -= attack.damage;
    this.state = "hit";
    this.hitstun = attack.hitstun;
    this.hitstop = 0.05;
    this.velocityX = attack.knockback * (this.sprite.x > attack.owner.sprite.x ? 1 : -1);

    if (this.health <= 0) this.state = "dead";
  }


  // ================= HITBOX HELPERS =================

  public updateAttackHitbox() {
    this.attackHitbox.x = this.sprite.x + this.facing * 45;
    this.attackHitbox.y = this.getLevelY(this.attackStance);
  }

  public updateBlockHitbox() {
    this.blockHitbox.x = this.sprite.x;
    this.blockHitbox.y = this.getLevelY(this.stance);
  }

  private resolvePlayerPush() {
    const a = this.hurtbox.getBounds();
    const b = this.opponent.hurtbox.getBounds();
    if (!Phaser.Geom.Intersects.RectangleToRectangle(a, b)) return;

    const overlap = a.width / 2 + b.width / 2 - Math.abs(a.centerX - b.centerX);
    const push = overlap / 2;

    if (a.centerX < b.centerX) {
      this.sprite.x -= push;
      this.opponent.sprite.x += push;
    } else {
      this.sprite.x += push;
      this.opponent.sprite.x -= push;
    }
  }

  // ================= STAMINA =================

  private createStaminaUI(x: number, y: number) {
    for (let i = 0; i < this.maxStamina / this.STAMINA_UNIT; i++) {
      this.staminaBlocks.push(
        this.scene.add.rectangle(x + i * 12, y, 10, 10, 0x00ff00),
      );
    }
  }

  private spendStamina(v: number) {
    this.stamina = Math.max(0, this.stamina - v);
  }

  private gainStamina(v: number) {
    this.stamina = Math.min(this.maxStamina, this.stamina + v);
  }

  private updateStaminaUI() {
    const units = Math.floor(this.stamina / this.STAMINA_UNIT);
    this.staminaBlocks.forEach((b, i) => b.setVisible(i < units));
  }

  // ================= TIMERS =================

  private updateTimers(dt: number) {
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.blockCooldown = Math.max(0, this.blockCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.hitstun = Math.max(0, this.hitstun - dt);
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.lastBlockTime = Math.max(0, this.lastBlockTime - dt);
    this.blockTimer = Math.max(0, this.blockTimer - dt);
    this.dashTimer = Math.max(0, this.dashTimer - dt);
    this.stunTimer = Math.max(0, this.stunTimer - dt);
  }

  private updateStance(input: InputFrame) {
    if (input.up) this.stance = "high";
    else if (input.down) this.stance = "low";
    else this.stance = "mid";
  }


  // ================= READ-ONLY API =================

  public getState() {
    return this.state;
  }

  public getAttackPhase() {
    return this.attackPhase;
  }

  public getCurrentAttackType(): AttackType | null {
    return this.currentAttack?.type ?? null;
  }

  public getFacing() {
    return this.facing;
  }

  public isBlocking() {
    return this.state === "block";
  }

  public isStunned() {
    return this.state === "stunned";
  }

  public getHealth() {
    return this.health;
  }

  public getAttackHitbox() {
    return this.attackHitbox;
  }

  public getVelocityX() {
    return this.velocityX;
  }

  public getActiveAttack(): AttackData | null {
    if (
      this.state === "attack" &&
      this.attackPhase === "active" &&
      this.currentAttack &&
      !this.currentAttack.hasHit
    ) {
      return this.currentAttack;
    }
    return null;
  }

  public getStamina(): number {
    return (this.stamina / 5) | 0;
  }

  private getLevelY(stance: Stance): number {
    return this.groundY - this.LEVEL_OFFSET[stance];
  }

  // ================= NETWORK SYNC =================
// ================= NETWORK SYNC =================

// Add these properties at the top of the Player class (near other properties)
private targetX: number = 0;
private targetY: number = 0;
private isRemotePlayer: boolean = false;
private interpolationSpeed: number = 0.2;

public syncFromServer(serverState: any) {
  // Mark this as a remote player
  this.isRemotePlayer = true;
  
  // Set target positions instead of snapping
  this.targetX = serverState.x;
  this.targetY = this.sprite.y;
  
  // Sync facing and flip
  this.facing = serverState.facing;
  this.sprite.setFlipX(this.facing === -1);
  
  // Sync state - IMMEDIATELY (no interpolation)
  this.state = serverState.state;
  this.stance = serverState.stance;
  this.attackPhase = serverState.attack?.phase || "startup"; // ADD THIS
  
  // Sync combat (these should be instant)
  this.health = serverState.health;
  this.stamina = serverState.stamina;
  
  // Sync attack if present
  if (serverState.attack) {
    this.currentAttack = {
      id: serverState.attack.id || Player.ATTACK_ID++,
      owner: this,
      type: serverState.attack.type,
      stance: serverState.attack.stance,
      damage: serverState.attack.type === "light" ? 10 : 20,
      hitstun: serverState.attack.type === "light" ? 0.15 : 0.25,
      knockback: serverState.attack.type === "light" ? 160 : 260,
      hasHit: serverState.attack.hasHit,
      canDashCancel: serverState.attack.type === "light",
      canAttackCancel: serverState.attack.type === "light",
    };
    this.attackStance = serverState.attack.stance;
  } else {
    this.currentAttack = undefined;
  }
}

public interpolateToTarget() {
  if (!this.isRemotePlayer) return;
  
  // Smoothly move toward target position
  const dx = this.targetX - this.sprite.x;
  
  // If very close, snap to target
  if (Math.abs(dx) < 1) {
    this.sprite.x = this.targetX;
  } else {
    // Lerp toward target
    this.sprite.x += dx * this.interpolationSpeed;
  }
}

public updateRemoteVisuals() {
  if (!this.isRemotePlayer) return;
  
  // Update attack hitbox visibility based on state
  if (this.state === "attack" && this.attackPhase === "active" && this.currentAttack) {
    this.attackHitbox.setVisible(true);
    this.updateAttackHitbox();
  } else {
    this.attackHitbox.setVisible(false);
  }
  
  // Update block hitbox visibility
  if (this.state === "block") {
    this.blockHitbox.setVisible(true);
    this.updateBlockHitbox();
  } else {
    this.blockHitbox.setVisible(false);
  }
  
  // Update hurtbox positions
  this.hurtbox.x = this.sprite.x;
  this.hurtbox.y = this.sprite.y - this.sprite.displayHeight / 2;
  this.hurtboxLow.x = this.sprite.x;
  this.hurtboxMid.x = this.sprite.x;
  this.hurtboxHigh.x = this.sprite.x;
}
}