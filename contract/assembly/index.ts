import { storage, u128 } from "near-sdk-as";
import * as marketplace from "./marketplace";

import { Chunk, ChunkMap, TileInfo, LandParcel, CHUNK_SIZE, CHUNK_COUNT } from "./model"

export function getLandParcelRange(x: i32, y: i32, width: i32, height: i32): LandParcel[] {
  return marketplace.getLandParcelRange(x, y, width, height);
}

export function offerChunk(x: u32, y: u32, price: string): void {
  marketplace.offerParcel(x, y, u128.from(price));
}

export function buyParcel(x: u32, y: u32): void {
  marketplace.buyParcel(x, y);
}

export function setTiles(tiles: TileInfo[]): void {
  assert(tiles.length > 0, 'setting 0 tiles not supported');

  let firstTile = tiles[0];
  let parcelX = firstTile.x / CHUNK_SIZE / CHUNK_COUNT;
  let parcelY = firstTile.y / CHUNK_SIZE / CHUNK_COUNT;
  let map = ChunkMap.get(parcelX, parcelY);
  map.setTiles(tiles);
}

export function getChunk(x: i32, y: i32): Chunk {
  return Chunk.get(x, y);
}

export function getParcelNonces(x: i32, y: i32): i32[][] {
  return ChunkMap.get(x, y).chunkNonces;
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