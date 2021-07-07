import { storage, u128 } from "near-sdk-as";
import { buyParcel_impl, LandParcel, getAllLandParcel_impl, offerParcel_impl} from "./marketplace";

import { Chunk, ChunkMap, TileInfo } from "./model"

export function getAllLandParcel(): LandParcel[] {
  return getAllLandParcel_impl();
}

export function offerChunk(parcelX: u32, parcelY: u32, price: string): void {
  offerParcel_impl(parcelX, parcelY, u128.from(price));
}

export function buyParcel(chunkX: u32, chunkY: u32): void {
  buyParcel_impl(chunkX, chunkY);
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