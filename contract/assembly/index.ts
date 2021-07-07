import { context, storage, util } from "near-sdk-as";

import { Chunk, ChunkMap, CHUNK_SIZE, TileInfo } from "./model"

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
  const lastPeerId = getPeerId(accountId);
  storage.setString('peerId:' + accountId, peerId);
  if (lastPeerId) {
    storage.delete('accountId:' + lastPeerId);
  }
  storage.setString('accountId:' + peerId, accountId);
}


// Web4

@nearBindgen
class Web4Request {
  accountId: string | null;
  path: string;
  params: Map<string, string>;
  query: Map<string, Array<string>>;
  preloads: Map<string, Web4Response>;
}

@nearBindgen
class Web4Response {
  contentType: string;
  body: Uint8Array;
  preloadUrls: string[] = [];
}

function htmlResponse(text: string): Web4Response {
  return { contentType: 'text/html; charset=UTF-8', body: util.stringToBytes(text) };
}

function svgResponse(text: string): Web4Response {
  return { contentType: 'image/svg+xml; charset=UTF-8', body: util.stringToBytes(text) };
}

export function web4_get(request: Web4Request): Web4Response {
  if (request.path.startsWith('/chunk')) {
    const parts = request.path.split('/');
    assert(parts.length == 3, 'Unrecognized chunk path: ' + request.path);

    const chunkId = parts[2];
    const chunkCoords = chunkId.split(',');
    assert(chunkCoords.length == 2, 'Unrecognized chunk ID: ' + chunkId);

    const chunk = getChunk(util.parseFromString<i32>(chunkCoords[0]), util.parseFromString<i32>(chunkCoords[1]));
    const pixels: string[] = [];
    for (let i = 0; i < 0; i++) {
      for (let j = 0; j < CHUNK_SIZE; j++) {
        pixels.push('<rect fill="#c03b27" x="' + j.toString() + '" y="' + i.toString() +'" width="1" height="1" />');
      }
    }

    return htmlResponse('omg gas: ' + context.usedGas.toString());

    return svgResponse(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 8" shape-rendering="crispEdges">`
      + pixels.join('\n') +
    `
      </svg>
    `);
  }
  
  return htmlResponse('Hello from Web4');
}
