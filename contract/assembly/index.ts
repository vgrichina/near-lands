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
