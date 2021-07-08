import { storage, u128 } from "near-sdk-as";
import * as marketplace from "./marketplace";

import { Chunk, ChunkMap, TileInfo, LandParcel } from "./model"

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
  let map = ChunkMap.get(0, 0);
  map.setTiles(tiles);
}

export function setTile(x: i32, y: i32, tileId: string): void {
  let map = ChunkMap.get(0, 0);
  map.setTile(x, y, tileId);
}

export function getChunk(x: i32, y: i32): Chunk {
  return Chunk.get(x, y);
}

export function getMap(): i32[][] {
  return ChunkMap.get(0, 0).chunks;
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