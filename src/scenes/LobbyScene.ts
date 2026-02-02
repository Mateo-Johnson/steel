import Phaser from "phaser";
import { NetworkManager } from "../network/NetworkManager";

export default class LobbyScene extends Phaser.Scene {
  private network!: NetworkManager;
  private roomCodeText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private inputText: string = "";
  private inputDisplay!: Phaser.GameObjects.Text;

  constructor() {
    super("LobbyScene");
  }

  create() {
    const { width, height } = this.scale;

    // Background
    this.cameras.main.setBackgroundColor("#1a1a2e");

    // Title
    this.add
      .text(width / 2, 80, "ONLINE MULTIPLAYER", {
        fontSize: "36px",
        color: "#eee",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Initialize network
    this.network = new NetworkManager("ws://localhost:3000");

    // Set up callbacks
    this.network.onRoomCreated = (code) => this.onRoomCreated(code);
    this.network.onRoomJoined = (code) => this.onRoomJoined(code);
    this.network.onMatchStart = () => this.onMatchStart();
    this.network.onError = (msg) => this.onError(msg);

    // Create Room Button
    this.createButton(width / 2, 180, "CREATE ROOM", () => this.createRoom());

    // Room Code Display
    this.roomCodeText = this.add
      .text(width / 2, 260, "", {
        fontSize: "48px",
        color: "#00ff88",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Join Room Section
    this.add
      .text(width / 2, 350, "Join Room:", {
        fontSize: "24px",
        color: "#ccc",
      })
      .setOrigin(0.5);

    // Input display (shows what user types)
    this.inputDisplay = this.add
      .text(width / 2, 410, "____", {
        fontSize: "32px",
        color: "#fff",
        backgroundColor: "#333",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5);

    // Join button
    this.createButton(width / 2, 490, "JOIN ROOM", () => this.joinRoom());

    // Status text
    this.statusText = this.add
      .text(width / 2, 570, "", {
        fontSize: "18px",
        color: "#888",
      })
      .setOrigin(0.5);

    // Back button
    this.add
      .text(50, height - 50, "← BACK", {
        fontSize: "20px",
        color: "#888",
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.network.disconnect();
        this.scene.start("MainMenu");
      });

    // Keyboard input for room code
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.key.length === 1 && /[a-z0-9]/i.test(event.key)) {
        if (this.inputText.length < 4) {
          this.inputText += event.key.toUpperCase();
          this.updateInputDisplay();
        }
      } else if (event.key === "Backspace") {
        this.inputText = this.inputText.slice(0, -1);
        this.updateInputDisplay();
      } else if (event.key === "Enter" && this.inputText.length === 4) {
        this.joinRoom();
      }
    });
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    callback: () => void
  ) {
    const btn = this.add
      .text(x, y, text, {
        fontSize: "24px",
        color: "#fff",
        backgroundColor: "#4a4a8a",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", function (this: Phaser.GameObjects.Text) {
        this.setBackgroundColor("#6a6aaa");
      })
      .on("pointerout", function (this: Phaser.GameObjects.Text) {
        this.setBackgroundColor("#4a4a8a");
      })
      .on("pointerdown", callback);

    return btn;
  }

  private updateInputDisplay() {
    const display = this.inputText.padEnd(4, "_");
    this.inputDisplay.setText(display);
  }

  private createRoom() {
    this.network.createRoom();
    this.statusText.setText("Creating room...");
  }

  private joinRoom() {
    if (this.inputText.length !== 4) {
      this.statusText.setText("Room code must be 4 characters");
      return;
    }
    this.network.joinRoom(this.inputText);
    this.statusText.setText(`Joining room ${this.inputText}...`);
  }

  private onRoomCreated(code: string) {
    this.roomCodeText.setText(`ROOM: ${code}`);
    this.statusText.setText("Waiting for opponent...");
  }

  private onRoomJoined(code: string) {
    this.statusText.setText(`Joined room ${code}. Waiting for host...`);
  }

  private onMatchStart() {
    this.statusText.setText("Match starting!");

    // Small delay for dramatic effect
    this.time.delayedCall(1000, () => {
      const scenes = ["TempleScene", "PagodaScene"];
      this.scene.start(Phaser.Utils.Array.GetRandom(scenes), {
        network: this.network,
      });
    });
  }

  private onError(message: string) {
    this.statusText.setText(`Error: ${message}`);
    this.inputText = "";
    this.updateInputDisplay();
  }
}