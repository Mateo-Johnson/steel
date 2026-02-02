import Phaser from "phaser";
import Player, { type InputFrame } from "../playable/Player";
import PlayerAnimationHandler from "../playable/AnimationHandler";
import { NetworkManager } from "../network/NetworkManager";

export default abstract class BaseFightScene extends Phaser.Scene {
  protected player1!: Player;
  protected player2!: Player;
  protected groundY!: number;
  private network?: NetworkManager;
  private frameNumber = 0;

  private p1Anim!: PlayerAnimationHandler;
  private p2Anim!: PlayerAnimationHandler;

  private p1HealthText!: Phaser.GameObjects.Text;
  private p2HealthText!: Phaser.GameObjects.Text;

  create(data?: { network?: NetworkManager }) {
    this.createStage();
    this.createAnimations();
    this.createFighters();
    
    // Use passed network or create undefined (for local play)
    this.network = data?.network;

    this.p1HealthText = this.add.text(20, 20, "", {
      fontSize: "20px",
      color: "#ffffff",
    });

    this.p2HealthText = this.add.text(500, 20, "", {
      fontSize: "20px",
      color: "#ff0000",
    });
  }

  private accumulator = 0;
  private readonly FIXED_DT = 1 / 60;

update(_: number, delta: number) {
  this.accumulator += delta / 1000;

  while (this.accumulator >= this.FIXED_DT) {
    const p1Input = this.readKeyboardP1();
    let p2Input: InputFrame;

    if (this.network) {
      // ONLINE MODE WITH PREDICTION
      
      this.network.sendInput(p1Input);

      p2Input = {
        left: false, right: false, up: false, down: false,
        light: false, heavy: false, block: false, dash: false
      };

      const isP1Local = this.network.playerIndex === 0;
      const localPlayer = isP1Local ? this.player1 : this.player2;
      const remotePlayer = isP1Local ? this.player2 : this.player1;
      const localInput = isP1Local ? p1Input : p2Input;

      // SYNC REMOTE PLAYER FROM SERVER FIRST
      if (this.network.lastServerState) {
        const state = this.network.lastServerState;
        const remoteIndex = isP1Local ? 1 : 0;
        
        if (state.players[remoteIndex]) {
          remotePlayer.syncFromServer(state.players[remoteIndex]);
        }
      }

      remotePlayer.interpolateToTarget();
      remotePlayer.updateRemoteVisuals();

      // NOW UPDATE LOCAL PLAYER (they can see opponent's position)
      localPlayer.update(this.FIXED_DT, localInput);

      // Server reconciliation for local player
      if (this.network.lastServerState) {
        const state = this.network.lastServerState;
        const localIndex = isP1Local ? 0 : 1;
        
        if (state.players[localIndex]) {
          const serverX = state.players[localIndex].x;
          const clientX = localPlayer.sprite.x;
          const error = Math.abs(serverX - clientX);

          if (error > 50) {
            console.warn(`Position mismatch! Client: ${clientX}, Server: ${serverX}`);
            localPlayer.sprite.x = serverX;
          }
          
          // Sync health/stamina but keep predicted position
          const currentX = localPlayer.sprite.x;
          localPlayer.syncFromServer(state.players[localIndex]);
          localPlayer.sprite.x = currentX;
        }
      }

      this.resolveCombat(this.player1, this.player2);
      this.resolveCombat(this.player2, this.player1);

    } else {
      // LOCAL MODE (unchanged)
      p2Input = this.readKeyboardP2();
      
      this.player1.update(this.FIXED_DT, p1Input);
      this.player2.update(this.FIXED_DT, p2Input);

      this.resolveCombat(this.player1, this.player2);
      this.resolveCombat(this.player2, this.player1);
    }

    this.keepPlayerInBounds(this.player1);
    this.keepPlayerInBounds(this.player2);

    this.frameNumber++;
    this.network?.nextFrame();
    this.accumulator -= this.FIXED_DT;
  }

  this.p1Anim.update();
  this.p2Anim.update();

  this.p1HealthText.setText(`P1: ${this.player1.getHealth()}`);
  this.p2HealthText.setText(`P2: ${this.player2.getHealth()}`);
}

  private readKeyboardP1(): InputFrame {
    const c = this.player1.input.cursors;
    const k = this.player1.input.keys;

    return {
      left: !!c.left?.isDown,
      right: !!c.right?.isDown,
      up: !!c.up?.isDown,
      down: !!c.down?.isDown,
      light: Phaser.Input.Keyboard.JustDown(k.light),
      heavy: Phaser.Input.Keyboard.JustDown(k.heavy),
      block: Phaser.Input.Keyboard.JustDown(k.block),
      dash: Phaser.Input.Keyboard.JustDown(k.dash),
    };
  }

  private readKeyboardP2(): InputFrame {
    const c = this.player2.input.cursors;
    const k = this.player2.input.keys;

    return {
      left: !!c.left?.isDown,
      right: !!c.right?.isDown,
      up: !!c.up?.isDown,
      down: !!c.down?.isDown,
      light: Phaser.Input.Keyboard.JustDown(k.light),
      heavy: Phaser.Input.Keyboard.JustDown(k.heavy),
      block: Phaser.Input.Keyboard.JustDown(k.block),
      dash: Phaser.Input.Keyboard.JustDown(k.dash),
    };
  }

  protected createFighters() {
    // Create players with custom hurtbox sizes
    this.player1 = new Player(this, 200, this.groundY, "p1", this.groundY);
    this.player2 = new Player(this, 600, this.groundY, "p2", this.groundY);

    this.player1.opponent = this.player2;
    this.player2.opponent = this.player1;

    this.p1Anim = new PlayerAnimationHandler(this.player1, "p1");
    this.p2Anim = new PlayerAnimationHandler(this.player2, "p2");
  }

  private resolveCombat(attacker: Player, defender: Player) {
    const attack = attacker.getActiveAttack();
    if (!attack) return;

    const aBox = attacker.getAttackHitbox().getBounds();
    const dBox = defender.hurtbox.getBounds();

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
    // IDLE
    this.anims.create({
      key: "p1_idle_0",
      frames: this.anims.generateFrameNumbers("p1_idle_0", { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_idle_1",
      frames: this.anims.generateFrameNumbers("p1_idle_1", { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_idle_2",
      frames: this.anims.generateFrameNumbers("p1_idle_2", { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_idle_3",
      frames: this.anims.generateFrameNumbers("p1_idle_3", { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_idle_4",
      frames: this.anims.generateFrameNumbers("p1_idle_4", { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_idle_5",
      frames: this.anims.generateFrameNumbers("p1_idle_5", { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_idle_6",
      frames: this.anims.generateFrameNumbers("p1_idle_6", { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_idle_7",
      frames: this.anims.generateFrameNumbers("p1_idle_7", { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_idle_8",
      frames: this.anims.generateFrameNumbers("p1_idle_8", { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: "p2_idle_0",
      frames: this.anims.generateFrameNumbers("p2_idle_0", { start: 0, end: 4 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_idle_1",
      frames: this.anims.generateFrameNumbers("p2_idle_1", { start: 0, end: 4 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_idle_2",
      frames: this.anims.generateFrameNumbers("p2_idle_2", { start: 0, end: 4 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_idle_3",
      frames: this.anims.generateFrameNumbers("p2_idle_3", { start: 0, end: 4 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_idle_4",
      frames: this.anims.generateFrameNumbers("p2_idle_4", { start: 0, end: 4 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_idle_5",
      frames: this.anims.generateFrameNumbers("p2_idle_5", { start: 0, end: 4 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_idle_6",
      frames: this.anims.generateFrameNumbers("p2_idle_6", { start: 0, end: 4 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_idle_7",
      frames: this.anims.generateFrameNumbers("p2_idle_7", { start: 0, end: 4 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_idle_8",
      frames: this.anims.generateFrameNumbers("p2_idle_8", { start: 0, end: 4 }),
      frameRate: 8,
      repeat: -1,
    });

    //walk
    this.anims.create({
      key: "p1_walk_0",
      frames: this.anims.generateFrameNumbers("p1_walk_0", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_walk_1",
      frames: this.anims.generateFrameNumbers("p1_walk_1", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_walk_2",
      frames: this.anims.generateFrameNumbers("p1_walk_2", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_walk_3",
      frames: this.anims.generateFrameNumbers("p1_walk_3", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_walk_4",
      frames: this.anims.generateFrameNumbers("p1_walk_4", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_walk_5",
      frames: this.anims.generateFrameNumbers("p1_walk_5", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_walk_6",
      frames: this.anims.generateFrameNumbers("p1_walk_6", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_walk_7",
      frames: this.anims.generateFrameNumbers("p1_walk_7", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p1_walk_8",
      frames: this.anims.generateFrameNumbers("p1_walk_8", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });

    this.anims.create({
      key: "p2_walk_0",
      frames: this.anims.generateFrameNumbers("p2_walk_0", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_walk_1",
      frames: this.anims.generateFrameNumbers("p2_walk_1", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_walk_2",
      frames: this.anims.generateFrameNumbers("p2_walk_2", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_walk_3",
      frames: this.anims.generateFrameNumbers("p2_walk_3", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_walk_4",
      frames: this.anims.generateFrameNumbers("p2_walk_4", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_walk_5",
      frames: this.anims.generateFrameNumbers("p2_walk_5", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_walk_6",
      frames: this.anims.generateFrameNumbers("p2_walk_6", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_walk_7",
      frames: this.anims.generateFrameNumbers("p2_walk_7", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_walk_8",
      frames: this.anims.generateFrameNumbers("p2_walk_8", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });

    this.anims.create({
      key: "p1_dash",
      frames: this.anims.generateFrameNumbers("p1_dash", { start: 0, end: 5 }),
      frameRate: 12,
      repeat: -1,
    });

    this.anims.create({
      key: "p1_block_mid",
      frames: this.anims.generateFrameNumbers("p1_block_mid", { start: 0, end: 1 }),
      frameRate: 12,
      repeat: 0,
    });
    this.anims.create({
      key: "p2_block_high",
      frames: this.anims.generateFrameNumbers("p2_block_high", { start: 0, end: 1 }),
      frameRate: 12,
      repeat: 0,
    });
    this.anims.create({
      key: "p2_hit",
      frames: this.anims.generateFrameNumbers("p2_hit", { start: 0, end: 1 }),
      frameRate: 12,
      repeat: 0,
    });

    this.anims.create({
      key: "p1_dead",
      frames: this.anims.generateFrameNumbers("p1_dead", { start: 0, end: 5 }),
      frameRate: 8,
      repeat: 0,
    });
    this.anims.create({
      key: "p2_dead",
      frames: this.anims.generateFrameNumbers("p2_dead", { start: 0, end: 5 }),
      frameRate: 8,
      repeat: 0,
    });

    this.anims.create({
      key: "p1_attack_light_mid",
      frames: this.anims.generateFrameNumbers("p1_attack_light_mid", { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_attack_light_mid",
      frames: this.anims.generateFrameNumbers("p2_attack_light_mid", { start: 0, end: 3 }),
      frameRate: 12,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_block_low",
      frames: this.anims.generateFrameNumbers("p2_block_low", { start: 0, end: 1 }),
      frameRate: 12,
      repeat: 0,
    });
    this.anims.create({
      key: "p2_block_mid",
      frames: this.anims.generateFrameNumbers("p2_block_mid", { start: 0, end: 1 }),
      frameRate: 12,
      repeat: 0,
    });
    this.anims.create({
      key: "p2_attack_light_low",
      frames: this.anims.generateFrameNumbers("p2_attack_light_low", { start: 0, end: 3 }),
      frameRate: 12,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_attack_light_high",
      frames: this.anims.generateFrameNumbers("p2_attack_light_high", { start: 0, end: 3 }),
      frameRate: 12,
      repeat: -1,
    });
    this.anims.create({
      key: "p2_attack_heavy_mid",
      frames: this.anims.generateFrameNumbers("p2_attack_heavy_mid", { start: 0, end: 4 }),
      frameRate: 12,
      repeat: 0,
    });
  }
}