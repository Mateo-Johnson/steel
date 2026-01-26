import Phaser from "phaser";

export type DummyState = "idle" | "attack" | "block" | "hit" | "stagger" | "dead";

export default class Dummy {
  public sprite: Phaser.GameObjects.Rectangle;
  public hitbox: Phaser.GameObjects.Rectangle;

  private state: DummyState = "idle";
  private facing: -1 | 1 = -1;

  private velocityY = 0;
  private knockbackX = 0;

  private readonly GRAVITY = 100;
  private readonly GROUND_Y = 573;

  private hitstun = 0;
  private hitstop = 0;

  private health = 200;

  // AI
  private aiTimer = 0;

  // block system
  private guard = 100;
  private readonly GUARD_MAX = 100;
  private readonly GUARD_REGEN = 15;
  private guardBroken = false;
  private guardBreakTime = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.add.rectangle(x, y, 50, 50, 0xff0000);
    this.hitbox = scene.add.rectangle(x, y, 40, 20, 0xff00ff).setVisible(false);
  }

  update(dt: number, player: any) {
    if (this.state === "dead") return;

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    this.velocityY += this.GRAVITY * dt;
    this.sprite.y += this.velocityY;

    if (this.sprite.y >= this.GROUND_Y) {
      this.sprite.y = this.GROUND_Y;
      this.velocityY = 0;
    }

    // AI
    this.aiTimer -= dt;
    if (this.aiTimer <= 0 && this.state !== "hit" && this.state !== "stagger") {
      this.aiTimer = 0.8 + Math.random() * 1.2;
      this.chooseAction(player);
    }

    if (this.state === "hit") {
      this.sprite.x += this.knockbackX * dt;
      this.hitstun -= dt;
      if (this.hitstun <= 0) {
        this.state = "idle";
        this.knockbackX = 0;
      }
    }

    if (this.state === "stagger") {
      this.hitstun -= dt;
      if (this.hitstun <= 0) this.state = "idle";
    }

    if (this.state === "block") {
      this.guard = Math.min(this.GUARD_MAX, this.guard + this.GUARD_REGEN * dt);
      if (this.guardBroken) {
        this.guardBreakTime -= dt;
        if (this.guardBreakTime <= 0) {
          this.guardBroken = false;
          this.state = "idle";
        }
      }
    }

    this.hitbox.x = this.sprite.x;
    this.hitbox.y = this.sprite.y;
  }

  private chooseAction(player: any) {
    const dist = Math.abs(player.sprite.x - this.sprite.x);

    if (this.guardBroken) return;

    const r = Math.random();
    if (r < 0.35 && dist < 150) {
      this.state = "attack";
      this.hitbox.setVisible(true);
    } else if (r < 0.6) {
      this.state = "block";
      this.hitbox.setVisible(true);
    } else {
      this.state = "idle";
      this.hitbox.setVisible(false);
    }

    this.facing = player.sprite.x < this.sprite.x ? -1 : 1;
  }

  applyKnockback(direction: -1 | 1, force: number, hitstun: number, isAirborne: boolean) {
    if (this.state === "dead") return;

    if (this.state === "block") {
      this.guard -= 25;
      if (this.guard <= 0) {
        this.guardBroken = true;
        this.guardBreakTime = 0.6;
        this.state = "stagger";
        this.hitstun = 0.5;
      }
      return;
    }

    if (this.state === "stagger") return;

    this.state = "hit";
    this.knockbackX = direction * force;
    this.velocityY = isAirborne ? -200 : -120;
    this.hitstun = hitstun;
    this.hitstop = 0.06;
  }

  applyDamage(amount: number) {
    if (this.state === "dead") return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.state = "dead";
      this.hitbox.setVisible(false);
      this.sprite.setVisible(false);
    }
  }

  public getHitbox() {
    return this.hitbox;
  }

  public isDead() {
    return this.state === "dead";
  }

  public isBlocking() {
    return this.state === "block";
  }

  public isAttacking() {
    return this.state === "attack";
  }

  public getState() {
    return this.state;
  }

  public getFacing(): -1 | 1 {
    return this.facing;
  }
}
