import { storage, u128 } from "near-sdk-as";
import { buyChunk_impl, ChunkMetaData, getAllChunkMetadata_impl, offerChunk_impl } from "./marketplace";

import { Chunk, ChunkMap, TileInfo } from "./model"

// --- contract code goes below


export function getAllChunkMetadata(): ChunkMetaData[] {
  return getAllChunkMetadata_impl();
}

export function offerChunk(chunk_x: u32, chunk_y: u32, price: string): void {
  offerChunk_impl(chunk_x, chunk_y, u128.from(price));
}

export function buyChunk(chunk_x: u32, chunk_y: u32): void {
  buyChunk_impl(chunk_x, chunk_y);
}

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
  const lastPeerId = getPeerId(accountId);
  storage.setString('peerId:' + accountId, peerId);
  if (lastPeerId) {
    storage.delete('accountId:' + lastPeerId);
  }
  storage.setString('accountId:' + peerId, accountId);
}