import Phaser from "phaser";
import Player from "../playable/Player";
import Dummy from "../playable/Dummy";

export default class TrainingScene extends Phaser.Scene {
  private player!: Player;
  private dummy!: Dummy;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: any;

  private lastHitTime = 0;
  private hitCooldown = 0.1;

  constructor() {
    super("TrainingScene");
  }

  create() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys({
      light: Phaser.Input.Keyboard.KeyCodes.Z,
      heavy: Phaser.Input.Keyboard.KeyCodes.X,
      block: Phaser.Input.Keyboard.KeyCodes.SPACE,
      dash: Phaser.Input.Keyboard.KeyCodes.SHIFT,
    });

    // animations
    this.anims.create({
      key: "walk",
      frames: this.anims.generateFrameNumbers("player_walk", { start: 0, end: 5 }),
      frameRate: 12,
      repeat: -1,
    });

    this.anims.create({
      key: "run",
      frames: this.anims.generateFrameNumbers("player_run", { start: 0, end: 5 }),
      frameRate: 12,
      repeat: -1,
    });

    this.anims.create({
      key: "block",
      frames: this.anims.generateFrameNumbers("player_block", { start: 0, end: 1 }),
      frameRate: 12,
      repeat: 0,
    });

    this.anims.create({
      key: "player_low_light",
      frames: this.anims.generateFrameNumbers("player_low_light", { start: 0, end: 3 }),
      frameRate: 12,
      repeat: 0,
    });

    this.anims.create({
      key: "player_dash_back",
      frames: this.anims.generateFrameNumbers("player_dash_back", { start: 0, end: 2 }),
      frameRate: 12,
      repeat: 0,
    });

    this.anims.create({
      key: "player_mid_light",
      frames: this.anims.generateFrameNumbers("player_mid_light", { start: 0, end: 3 }),
      frameRate: 12,
      repeat: 0,
    });

    this.anims.create({
      key: "player_idle",
      frames: this.anims.generateFrameNumbers("player_idle", { start: 0, end: 5 }),
      frameRate: 12,
      repeat: -1,
    });

    this.anims.create({
      key: "player_high_light",
      frames: this.anims.generateFrameNumbers("player_high_light", { start: 0, end: 8 }),
      frameRate: 24,
      repeat: 0,
    });

    this.anims.create({
      key: "player_high_heavy",
      frames: this.anims.generateFrameNumbers("player_high_heavy", { start: 0, end: 8 }),
      frameRate: 24,
      repeat: 0,
    });

    this.player = new Player(this, 200, 450);
    this.dummy = new Dummy(this, 500, 450);
  }

  update(_: number, delta: number) {
    const dt = delta / 1000;
    const input = { cursors: this.cursors, keys: this.keys };

    this.player.update(dt, input);
    this.dummy.update(dt);

    this.lastHitTime -= dt;

    // attack collision + damage
    if (this.player.isCurrentlyAttacking() && this.lastHitTime <= 0) {
      const a = this.player.getAttackHitbox().getBounds();
      const d = this.dummy.getHitbox().getBounds();

      if (Phaser.Geom.Intersects.RectangleToRectangle(a, d)) {
        const direction = this.player.getFacing();
        const type = this.player.getAttackType();

        const knockback = type === "light" ? 200 : 450;
        const hitstun = type === "light" ? 0.15 : 0.25;

        // damage comes from Player
        const damage = this.player.getAttackDamage();

        this.dummy.applyKnockback(direction, knockback, hitstun);
        this.dummy.applyDamage(damage);

        this.lastHitTime = this.hitCooldown;
      }
    }
  }
}
