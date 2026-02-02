import { PlayerState } from "./PlayerState.ts";

export class Room {
  code: string;
  players: Map<string, PlayerState> = new Map();
  frame: number = 0; // ADD THIS

  constructor(code: string) {
    this.code = code;
  }

  isFull() {
    return this.players.size >= 2;
  }

  addPlayer(clientId: string, player: PlayerState) {
    if (this.isFull()) return false;
    this.players.set(clientId, player);
    return true;
  }

  removePlayer(clientId: string) {
    this.players.delete(clientId);
  }

  snapshot() {
    return Array.from(this.players.values()).map(p => p.snapshot());
  }
}