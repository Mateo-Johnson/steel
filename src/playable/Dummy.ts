import Phaser from "phaser";

type DummyState = "idle" | "hit" | "dead";

export default class Dummy {
  public sprite: Phaser.GameObjects.Rectangle;
  public hitbox: Phaser.GameObjects.Rectangle;

  private state: DummyState = "idle";

  private velocityY = 0;
  private knockbackX = 0;

  private readonly GRAVITY = 100;
  private readonly GROUND_Y = 573;

  private hitstun = 0;

  private health = 120;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.add.rectangle(x, y, 50, 50, 0xff0000);
    this.hitbox = scene.add.rectangle(x, y, 40, 20, 0xff00ff).setVisible(false);
  }

  update(dt: number) {
    if (this.state === "dead") return;
    // gravity
    this.velocityY += this.GRAVITY * dt;
    this.sprite.y += this.velocityY;

    // hitstun
    if (this.state === "hit") {
      this.sprite.x += this.knockbackX * dt;
      this.hitstun -= dt;

      if (this.hitstun <= 0) {
        this.state = "idle";
        this.knockbackX = 0;
      }
    }

    if (this.sprite.y >= this.GROUND_Y) {
      this.sprite.y = this.GROUND_Y;
      this.velocityY = 0;
    }

    // keep hitbox following
    this.hitbox.x = this.sprite.x;
    this.hitbox.y = this.sprite.y;
  }

  applyKnockback(direction: -1 | 1, force: number, hitstun: number) {
    if (this.state === "dead") return;
    this.state = "hit";
    this.knockbackX = direction * force;
    this.velocityY = -10; // lift
    this.hitstun = hitstun;
  }

  applyDamage(amount: number) {
    if (this.state === "dead") return;
    this.health -= amount;
    if(this.health <= 0) {
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
}
