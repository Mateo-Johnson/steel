import Phaser from "phaser";

export type Stance = "low" | "mid" | "high";
export type AttackType = "light" | "heavy";

type PlayerState = "idle" | "dash" | "attack" | "block";

export default class Player {
  private scene: Phaser.Scene;

  public sprite: Phaser.GameObjects.Sprite;

  public attackHitbox: Phaser.GameObjects.Rectangle;
  public blockHitbox: Phaser.GameObjects.Rectangle;

  private state: PlayerState = "idle";

  private facing: -1 | 1 = 1;
  private velocityY = 0;

  private dashTime = 0;
  private dashCooldown = 0;
  private dashDir: -1 | 1 = 1;
  private dashSpeed = 0;

  private attackCooldown = 0;
  private attackType: AttackType = "light";

  private blockTime = 0;
  private blockCooldown = 0;

  private stance: Stance = "mid";

  // NEW: locked stance for attack
  private attackStance: Stance = "mid";

  private readonly SPEED = 200;
  private readonly GRAVITY = 100;
  private readonly GROUND_Y = 600;

  private readonly DASH_SPEED = 600;
  private readonly DASH_DURATION = 0.15;
  private readonly DASH_COOLDOWN = 0.5;

  private readonly BACK_DASH_SPEED = 300;
  private readonly BACK_DASH_DURATION = 0.1;

  private readonly LIGHT_COOLDOWN = 0.4;
  private readonly HEAVY_COOLDOWN = 1.0;

  private readonly BLOCK_DURATION = 0.2;
  private readonly BLOCK_COOLDOWN = 0.2;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    // bottom origin (so taller textures don't sink)
    this.sprite = scene.add.sprite(x, y, "player_idle");
    this.sprite.setOrigin(0.5, 1);

    this.attackHitbox = scene.add.rectangle(0, 0, 60, 20, 0xffff00).setVisible(false);
    this.blockHitbox = scene.add.rectangle(0, 0, 40, 20, 0x00ff00).setVisible(false);
  }

  update(dt: number, input: any) {
    // gravity
    this.velocityY += this.GRAVITY * dt;
    this.sprite.y += this.velocityY;

    // ground clamp based on actual sprite height
    const spriteBottom = this.sprite.y;
    if (spriteBottom >= this.GROUND_Y) {
      this.sprite.y = this.GROUND_Y;
      this.velocityY = 0;
    }

    // cooldowns
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.blockCooldown = Math.max(0, this.blockCooldown - dt);

    // stance (only affects stance outside attacks)
    if (input.cursors.up.isDown) this.stance = "high";
    else if (input.cursors.down.isDown) this.stance = "low";
    else this.stance = "mid";

    switch (this.state) {
      case "idle":
        this.handleMovement(input, dt);
        this.handleDash(input);
        this.handleBlock(input);
        this.handleAttack(input);

        if (this.state !== "idle") break;

        if (input.cursors.left.isDown || input.cursors.right.isDown) {
          this.sprite.play("walk", true);
        } else {
          this.sprite.play("player_idle", true);
        }
        break;

      case "dash":
        this.dashTime -= dt;
        this.sprite.x += this.dashDir * this.dashSpeed * dt;

        if (this.dashDir === this.facing) {
          this.sprite.play("run", true);
        } else {
          this.sprite.play("player_dash_back", true);
        }

        if (this.dashTime <= 0) this.state = "idle";
        break;

      case "block":
        this.sprite.play("block", true);
        this.blockTime -= dt;
        this.updateHitbox(this.blockHitbox);

        if (this.blockTime <= 0) this.endBlock();
        break;

      case "attack":
        this.updateHitbox(this.attackHitbox);
        break;
    }

    this.sprite.setFlipX(this.facing === -1);
  }

  private handleMovement(input: any, dt: number) {
    if (input.cursors.left.isDown) {
      this.sprite.x -= this.SPEED * dt;
      this.facing = -1;
    }
    if (input.cursors.right.isDown) {
      this.sprite.x += this.SPEED * dt;
      this.facing = 1;
    }
  }

  private handleDash(input: any) {
    if (Phaser.Input.Keyboard.JustDown(input.keys.dash) && this.dashCooldown <= 0) {
      let dir = this.facing;
      let speed = this.DASH_SPEED;
      let duration = this.DASH_DURATION;

      if (
        (input.cursors.left.isDown && this.facing === 1) ||
        (input.cursors.right.isDown && this.facing === -1) ||
        (!input.cursors.left.isDown && !input.cursors.right.isDown)
      ) {
        dir = this.facing === 1 ? -1 : 1;
        speed = this.BACK_DASH_SPEED;
        duration = this.BACK_DASH_DURATION;
      }

      this.startDash(dir, speed, duration);
    }
  }

  private handleBlock(input: any) {
    if (Phaser.Input.Keyboard.JustDown(input.keys.block) && this.blockCooldown <= 0) {
      this.startBlock();
    }
  }

  private handleAttack(input: any) {
    if (this.attackCooldown > 0) return;

    // no attacking while moving
    if (input.cursors.left.isDown || input.cursors.right.isDown) return;

    if (Phaser.Input.Keyboard.JustDown(input.keys.light)) this.startAttack("light");

    // HEAVY ATTACK DISABLED
    // if (Phaser.Input.Keyboard.JustDown(input.keys.heavy)) this.startAttack("heavy");
  }

  private startDash(dir: -1 | 1, speed: number, duration: number) {
    this.state = "dash";
    this.dashDir = dir;
    this.dashSpeed = speed;
    this.dashTime = duration;
    this.dashCooldown = this.DASH_COOLDOWN;
  }

  private getAttackAnimKey(): string {
    return `player_${this.attackStance}_${this.attackType}`;
  }

  private startAttack(type: AttackType) {
    this.state = "attack";
    this.attackType = type;

    // LOCK stance at attack start
    this.attackStance = this.stance;

    this.attackHitbox.setVisible(true);
    this.attackCooldown = type === "light" ? this.LIGHT_COOLDOWN : this.HEAVY_COOLDOWN;

    const animKey = this.getAttackAnimKey();
    this.sprite.play(animKey);

    this.sprite.once(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      (anim: Phaser.Animations.Animation) => {
        if (anim.key !== animKey) return;
        this.endAttack();
      }
    );
  }

  private endAttack() {
    this.state = "idle";
    this.attackHitbox.setVisible(false);
  }

  private startBlock() {
    this.state = "block";
    this.blockTime = this.BLOCK_DURATION;
    this.blockCooldown = this.BLOCK_COOLDOWN;
    this.blockHitbox.setVisible(true);
  }

  private endBlock() {
    this.state = "idle";
    this.blockHitbox.setVisible(false);
  }

  private updateHitbox(box: Phaser.GameObjects.Rectangle) {
    // Determine facing-based X offset
    const offsetX = (this.sprite.displayWidth / 2) + (box.width / 2) - 90;
    const x = this.sprite.x + this.facing * offsetX;

    // Determine base Y and stance offset
    const baseY = this.sprite.y - this.sprite.displayHeight * 0.5;
    const stanceOffset = this.sprite.displayHeight * 0.25;

    // Different logic for attack vs block
    if (this.state === "attack") {
      box.x = x;
      const stance = this.attackStance;

      if (stance === "high") box.y = baseY - stanceOffset;
      else if (stance === "low") box.y = baseY + stanceOffset;
      else box.y = baseY;

      // attack hitbox should be more forward
      box.x += this.facing * 10;
      box.width = 60;
      box.height = 20;
    } else if (this.state === "block") {
      box.x = x;

      // block hitbox sits closer and higher/lower depending on stance
      if (this.stance === "high") box.y = baseY - stanceOffset * 0.5;
      else if (this.stance === "low") box.y = baseY + stanceOffset * 0.5;
      else box.y = baseY;

      // block hitbox should be closer and slightly bigger
      box.x += this.facing * 5;
      box.width = 40;
      box.height = 30;
    }
  }



  public getFacing(): -1 | 1 {
    return this.facing;
  }

  public getAttackType(): AttackType {
    return this.attackType;
  }

  public isCurrentlyAttacking() {
    return this.state === "attack";
  }

  public getAttackHitbox() {
    return this.attackHitbox;
  }

  public isBlocking() {
    return this.state === "block";
  }

  public getAttackDamage(): number {
    return this.attackType === "light" ? 60 : 120;
  }
}
