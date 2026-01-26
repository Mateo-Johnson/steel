import Phaser from "phaser";
import Player from "../playable/Player";

export default class GameScene extends Phaser.Scene {
  private player!: Player;

  constructor() {
    super("GameScene");
  }

  create () {
    if (!this.input.keyboard) {
      throw new Error("input not enabled");
    }

    this.player = new Player(this, 400, 300);
  }

  update(_: number, delta: number) {
    const dt = delta / 1000;
    this.player.update(dt, this.input.keyboard);
  }
}