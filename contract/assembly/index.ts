import { storage } from "near-sdk-as";

import { Chunk, ChunkMap } from "./model"

// --- contract code goes below

export function setPixel(x: i32, y: i32, rgb: string): void {
  let chunk = getChunk(x, y);
  chunk.setPixel(x, y, rgb);
  storage.setBytes(Chunk.key(x, y), chunk.encode());
  let map = _getMap();
  map.setChunk(x, y, chunk);
  storage.setBytes('chunkMap', map.encode());
}

export function getChunk(x: i32, y: i32): Chunk {
  let chunkKey = Chunk.key(x, y);
  let chunkBytes = storage.getBytes(chunkKey);
  if (chunkBytes == null) {
    return new Chunk();
  }
  return Chunk.decode(chunkBytes);
}

export function getMap(): i32[][] {
  return _getMap().chunks;
}

function _getMap(): ChunkMap {
  let mapBytes = storage.getBytes('chunkMap');
  if (mapBytes == null) {
    return new ChunkMap();
  } 
  return ChunkMap.decode(mapBytes);
}
