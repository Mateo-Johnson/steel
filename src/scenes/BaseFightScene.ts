import Phaser from "phaser";
import Player from "../playable/Player";
import PlayerAnimationHandler from "../playable/AnimationHandler";

export default abstract class BaseFightScene extends Phaser.Scene {
  protected player1!: Player;
  protected player2!: Player;
  protected groundY!: number;

  private p1Anim!: PlayerAnimationHandler;
  private p2Anim!: PlayerAnimationHandler;

  private p1HealthText!: Phaser.GameObjects.Text;
  private p2HealthText!: Phaser.GameObjects.Text;

  create() {
    this.createStage();
    this.createAnimations();
    this.createFighters();

    this.p1HealthText = this.add.text(20, 20, "", {
      fontSize: "20px",
      color: "#ffffff",
    });

    this.p2HealthText = this.add.text(500, 20, "", {
      fontSize: "20px",
      color: "#ff0000",
    });
  }

  update(_: number, delta: number) {
    const dt = delta / 1000;

    this.player1.update(dt);
    this.player2.update(dt);

    this.p1Anim.update();
    this.p2Anim.update();

    this.resolveCombat(this.player1, this.player2);
    this.resolveCombat(this.player2, this.player1);

    this.keepPlayerInBounds(this.player1);
    this.keepPlayerInBounds(this.player2);

    this.p1HealthText.setText(`P1: ${this.player1.getHealth()}`);
    this.p2HealthText.setText(`P2: ${this.player2.getHealth()}`);
  }

  protected createFighters() {
    // Create players with custom hurtbox sizes
    this.player1 = new Player(this, 200, this.groundY, "p1", this.groundY, {
      hurtboxWidth: 50,
      hurtboxHeight: 130,
    });

    this.player2 = new Player(this, 600, this.groundY, "p2", this.groundY, {
      hurtboxWidth: 60,
      hurtboxHeight: 150,
    });

    this.player1.opponent = this.player2;
    this.player2.opponent = this.player1;

    this.p1Anim = new PlayerAnimationHandler(this, this.player1, "p1");
    this.p2Anim = new PlayerAnimationHandler(this, this.player2, "p2");
  }

  private resolveCombat(attacker: Player, defender: Player) {
    const attack = attacker.getActiveAttack();
    if (!attack) return;

    const aBox = attacker.getAttackHitbox().getBounds();
    const dBox = defender.hurtbox.getBounds(); // now using hurtbox

    if (!Phaser.Geom.Intersects.RectangleToRectangle(aBox, dBox)) return;

    attack.hasHit = true;
    defender.resolveIncomingAttack(attack);
  }

  protected abstract createStage(): void;

  private keepPlayerInBounds(player: Player) {
    const sprite = player.sprite;
    const halfWidth = sprite.displayWidth / 2;

    // Horizontal bounds
    if (sprite.x - halfWidth < 0) {
      sprite.x = halfWidth;
    } else if (sprite.x + halfWidth > this.scale.width) {
      sprite.x = this.scale.width - halfWidth;
    }

    // Vertical bounds
    const topLimit = 0;
    const bottomLimit = this.groundY;

    if (sprite.y - sprite.displayHeight / 2 < topLimit) {
      sprite.y = topLimit + sprite.displayHeight / 2;
    } else if (sprite.y > bottomLimit) {
      sprite.y = bottomLimit;
    }
  }

  protected createAnimations() {
    if (this.anims.exists("p1_idle")) return;

    // IDLE
    this.anims.create({
      key: "p1_idle",
      frames: this.anims.generateFrameNumbers("p1_idle", { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: "p2_idle",
      frames: this.anims.generateFrameNumbers("p2_idle", { start: 0, end: 4 }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: "p1_walk",
      frames: this.anims.generateFrameNumbers("p1_walk", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });

    this.anims.create({
      key: "p1_dash",
      frames: this.anims.generateFrameNumbers("p1_dash", { start: 0, end: 5 }),
      frameRate: 12,
      repeat: -1,
    });

  }
}
