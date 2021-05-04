import { storage } from "near-sdk-as";

import { Chunk, ChunkMap, TileInfo } from "./model"

// --- contract code goes below

export function setTiles(tiles: TileInfo[]): void {
  let map = ChunkMap.get();
  map.setTiles(tiles);
}

export function setTile(x: i32, y: i32, tileId: string): void {
  let map = ChunkMap.get();
  map.setTile(x, y, tileId);
}

export function getChunk(x: i32, y: i32): Chunk {
  return Chunk.get(x, y);
}

export function getMap(): i32[][] {
  return ChunkMap.get().chunks;
}

export function getPeerId(accountId: string): string | null {
  return storage.getString('peerId:' + accountId);
}

export function getAccountId(peerId: string): string | null {
  return storage.getString('accountId:' + peerId);
}

// TODO: Verify signature to make sure peer ID is not bogus
export function setPeerId(accountId: string, peerId: string): void {
  storage.setString('peerId:' + accountId, peerId);
  storage.setString('accountId:' + peerId, accountId);
}