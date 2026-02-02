import Phaser from "phaser";

export default class MainMenu extends Phaser.Scene {
  private options: Phaser.GameObjects.Image[] = [];
  private selectedIndex = 0;

  private readonly menuItems = [
    "Start Game",
    "Training",
    "Options",
    "Credits",
    "Quit"
  ];

  private readonly buttonImages: Record<string, string> = {
    "Start Game": "buttonStart",
    "Training": "buttonTraining",
    "Options": "buttonOptions",
    "Credits": "buttonCredits",
    "Quit": "buttonQuit"
  };

  constructor() {
    super("MainMenu");
  }

  preload() {
    this.load.image("starter", "assets/starter.png");

    Object.values(this.buttonImages).forEach(key => {
      this.load.image(key, `assets/${key}.png`);
    });
  }

  create() {
    const { width, height } = this.scale;

    const starterImage = this.add.image(width / 2, height / 2, "starter")
      .setOrigin(0.5);

    const scaleX = width / starterImage.width;
    const scaleY = height / starterImage.height;
    starterImage.setScale(Math.min(scaleX, scaleY));

    this.input.keyboard!.once("keydown", () => {
      this.initMenu();
    });
  }

  private initMenu() {
    const { width } = this.scale;

    this.options = [];
    this.selectedIndex = 0;

    const startY = 320;
    const spacing = 50;

    this.menuItems.forEach((label, index) => {
      const yPos = startY + index * spacing;

      const image = this.add.image(width / 2, yPos, this.buttonImages[label])
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setAlpha(0);

      image.on("pointerover", () => this.select(index));
      image.on("pointerdown", () => this.activate(index));

      this.options.push(image);
    });

    this.updateSelection();

    // Fade-in
    this.tweens.add({
      targets: this.options,
      alpha: 1,
      duration: 350,
      ease: "Power1",
      stagger: 80
    });

    // Keyboard input
    const keys = this.input.keyboard?.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER
    }) as any;

    keys.up.on("down", () => this.moveSelection(-1));
    keys.down.on("down", () => this.moveSelection(1));
    keys.enter.on("down", () => this.activate(this.selectedIndex));
  }

  private moveSelection(dir: number) {
    this.selectedIndex =
      (this.selectedIndex + dir + this.options.length) % this.options.length;

    this.updateSelection();
  }

  private select(index: number) {
    this.selectedIndex = index;
    this.updateSelection();
  }

  private updateSelection() {
    this.options.forEach((image, index) => {
      this.tweens.killTweensOf(image);

      this.tweens.add({
        targets: image,
        scale: index === this.selectedIndex ? 0.35 : 0.3,
        duration: 120,
        ease: "Power2"
      });
    });
  }

  private activate(index: number) {
    const choice = this.menuItems[index];

    switch (choice) {
      case "Start Game": {
        this.scene.start("LobbyScene");
        break;
      }

      case "Training":
        this.scene.start("TrainingScene");
        break;

      case "Options":
        console.log("Options selected");
        break;

      case "Credits":
        console.log("Credits selected");
        break;

      case "Quit":
        console.log("Quit selected");
        break;
    }
  }
}
