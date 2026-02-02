import type { InputFrame } from "../playable/InputFrame";

type NetworkMessage =
  | { type: "room_created"; code: string; playerIndex: number }
  | { type: "room_joined"; code: string; playerIndex: number }
  | { type: "match_start" }
  | { type: "game_state"; state: any }
  | { type: "opponent_disconnected" }
  | { type: "error"; message: string };

export class NetworkManager {
  ws: WebSocket;
  frame: number = 0;
  localInputs: Map<number, InputFrame> = new Map();
  remoteInputs: Map<number, InputFrame> = new Map();
  
  roomCode: string | null = null;
  playerIndex: number = -1;
  isMatchStarted: boolean = false;
  lastServerState: any = null;

  // Callbacks for the scenes to hook into
  onRoomCreated?: (code: string) => void;
  onRoomJoined?: (code: string) => void;
  onMatchStart?: () => void;
  onError?: (message: string) => void;

  constructor(url: string) {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("✅ Connected to server");
    };

    this.ws.onmessage = (event) => {
      const msg: NetworkMessage = JSON.parse(event.data);
      this.handleMessage(msg);
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    this.ws.onclose = () => {
      console.log("❌ Disconnected from server");
    };
  }

  private handleMessage(msg: NetworkMessage) {
    switch (msg.type) {
      case "room_created":
        this.roomCode = msg.code;
        this.playerIndex = msg.playerIndex;
        console.log(`🏠 Room created: ${msg.code} (You are P${msg.playerIndex + 1})`);
        this.onRoomCreated?.(msg.code);
        break;

      case "room_joined":
        this.roomCode = msg.code;
        this.playerIndex = msg.playerIndex;
        console.log(`➕ Joined room: ${msg.code} (You are P${msg.playerIndex + 1})`);
        this.onRoomJoined?.(msg.code);
        break;

      case "match_start":
        this.isMatchStarted = true;
        console.log("🎮 Match started!");
        this.onMatchStart?.();
        break;

      case "game_state":
        // Store the authoritative state from server
        this.lastServerState = msg.state;
        break;

      case "opponent_disconnected":
        console.log("Opponent disconnected!");
        this.onError?.("Opponent disconnected");
        break;

      case "error":
        console.error("Server error:", msg.message);
        this.onError?.(msg.message);
        break;
    }
  }

  createRoom() {
    if (this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not connected");
      return;
    }
    this.ws.send(JSON.stringify({ type: "create_room" }));
  }

  joinRoom(code: string) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not connected");
      return;
    }
    this.ws.send(JSON.stringify({ type: "join_room", code: code.toUpperCase() }));
  }

  sendInput(input: InputFrame) {
    if (!this.isMatchStarted) return;
    
    this.localInputs.set(this.frame, input);
    this.ws.send(
      JSON.stringify({
        type: "input",
        frame: this.frame,
        input,
      })
    );
  }

  getRemoteInput(frame: number): InputFrame | null {
    return this.remoteInputs.get(frame) ?? null;
  }

  nextFrame() {
    this.frame++;
  }

  disconnect() {
    this.ws.close();
  }
}