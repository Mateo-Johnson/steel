import { WebSocketServer, WebSocket } from "ws";
import { PlayerState } from "./server/PlayerState.ts";
import type { InputFrame } from "./server/PlayerState.ts";
import { Room } from "./server/Room.ts";

// ================= SERVER =================

const PORT = 3000;
const wss = new WebSocketServer({ port: PORT });

console.log(`✅ Server running on ws://localhost:${PORT}`);

// ================= STATE =================

const clients = new Map<string, WebSocket>();
const rooms = new Map<string, Room>();

// Map client IDs to their room codes
const clientRooms = new Map<string, string>();

// Store inputs per room per frame
const roomInputs = new Map<string, Map<number, Map<string, InputFrame>>>();

// ================= HELPERS =================

function generateClientId() {
  return Math.random().toString(36).slice(2);
}

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

// ================= GAME LOOP =================

const TICK_RATE = 60;
const FRAME_TIME = 1000 / TICK_RATE;

setInterval(() => {
  rooms.forEach((room, roomCode) => {
    if (!room.isFull()) return;

    const frameInputs = roomInputs.get(roomCode);
    if (!frameInputs) return;

    // Get current frame (assume synchronized)
    const currentFrame = room.frame || 0;
    const inputs = frameInputs.get(currentFrame);

    if (!inputs || inputs.size < 2) {
      // Not all players have submitted input for this frame yet
      return;
    }

    // Get both players
    const playerArray = Array.from(room.players.entries());
    const [clientId1, p1] = playerArray[0];
    const [clientId2, p2] = playerArray[1];

    const input1 = inputs.get(clientId1);
    const input2 = inputs.get(clientId2);

    if (!input1 || !input2) return;

    // UPDATE FACING DIRECTION BEFORE UPDATE
    p1.updateFacing(p2.x);
    p2.updateFacing(p1.x);

    // Update both players
    p1.update(FRAME_TIME / 1000, input1);
    p2.update(FRAME_TIME / 1000, input2);

    // Check for collisions/hits
    checkCombat(p1, p2);
    checkCombat(p2, p1);

    // Broadcast state to both clients
    const state = {
      frame: currentFrame,
      players: [p1.snapshot(), p2.snapshot()],
    };

    room.players.forEach((_, clientId) => {
      clients.get(clientId)?.send(
        JSON.stringify({
          type: "game_state",
          state,
        })
      );
    });

    // Increment frame
    room.frame = currentFrame + 1;

    // Clean old inputs (keep last 60 frames for lag compensation)
    frameInputs.forEach((_, frame) => {
      if (frame < currentFrame - 60) {
        frameInputs.delete(frame);
      }
    });
  });
}, FRAME_TIME);

function checkCombat(attacker: PlayerState, defender: PlayerState) {
  if (!attacker.currentAttack) return;
  if (attacker.currentAttack.phase !== "active") return;
  if (attacker.currentAttack.hasHit) return;

  // Simple distance check (you'll need proper hitbox logic)
  const distance = Math.abs(attacker.x - defender.x);
  const hitRange = 80; // Adjust based on your game

  if (distance < hitRange) {
    defender.applyHit(attacker);
  }
}

// ================= CONNECTION =================

wss.on("connection", (ws) => {
  const clientId = generateClientId();
  clients.set(clientId, ws);

  console.log(`🔌 Client connected: ${clientId}`);

  ws.on("message", (data) => {
    let msg: any;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    // ---------- CREATE ROOM ----------
    if (msg.type === "create_room") {
      const code = generateRoomCode();
      const room = new Room(code);

      room.addPlayer(clientId, new PlayerState(100));
      rooms.set(code, room);
      clientRooms.set(clientId, code);
      roomInputs.set(code, new Map());

      ws.send(
        JSON.stringify({
          type: "room_created",
          code,
          playerIndex: 0,
        })
      );

      console.log(`🏠 Room created: ${code}`);
    }

    // ---------- JOIN ROOM ----------
    if (msg.type === "join_room") {
      const room = rooms.get(msg.code);

      if (!room || room.isFull()) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Room not found or full",
          })
        );
        return;
      }

      room.addPlayer(clientId, new PlayerState(500));
      clientRooms.set(clientId, msg.code);

      ws.send(
        JSON.stringify({
          type: "room_joined",
          code: msg.code,
          playerIndex: 1,
        })
      );

      console.log(`➕ Client ${clientId} joined room ${msg.code}`);

      // Notify both players match is ready
      room.players.forEach((_, id) => {
        clients.get(id)?.send(
          JSON.stringify({
            type: "match_start",
          })
        );
      });
    }

    // ---------- INPUT ----------
    if (msg.type === "input") {
      const roomCode = clientRooms.get(clientId);
      if (!roomCode) return;

      const frameInputs = roomInputs.get(roomCode);
      if (!frameInputs) return;

      const frame = msg.frame;
      if (!frameInputs.has(frame)) {
        frameInputs.set(frame, new Map());
      }

      frameInputs.get(frame)!.set(clientId, msg.input);
    }
  });

  ws.on("close", () => {
    clients.delete(clientId);

    // Remove from room
    const roomCode = clientRooms.get(clientId);
    if (roomCode) {
      const room = rooms.get(roomCode);
      if (room) {
        room.removePlayer(clientId);

        // Notify other player
        room.players.forEach((_, id) => {
          clients.get(id)?.send(
            JSON.stringify({
              type: "opponent_disconnected",
            })
          );
        });

        // Delete empty rooms
        if (room.players.size === 0) {
          rooms.delete(roomCode);
          roomInputs.delete(roomCode);
          console.log(`🗑 Room deleted: ${roomCode}`);
        }
      }
      clientRooms.delete(clientId);
    }

    console.log(`❌ Client disconnected: ${clientId}`);
  });
});