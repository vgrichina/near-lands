import { storage, u128 } from "near-sdk-as";

const CHUNK_SIZE = 16;
export const CHUNK_COUNT = 5;
const START_TILE_ID = "-1";

@nearBindgen
export class Chunk {
  nonce: i32;
  tiles: string[][];

  constructor() {
    this.tiles = new Array<Array<string>>(CHUNK_SIZE);
    for (let i = 0; i < CHUNK_SIZE; i++) {
      this.tiles[i] = new Array<string>(CHUNK_SIZE);
      for (let j = 0; j < CHUNK_SIZE; j++) {
        this.tiles[i][j] = START_TILE_ID;
      }
    }
  }

  static key(x: i32, y: i32): string {
    checkMapBounds(x, y);
    let cx = x / CHUNK_SIZE;
    let cy = y / CHUNK_SIZE;
    return 'chunk:' + cx.toString() + ':' + cy.toString();
  }

  static get(x: i32, y: i32): Chunk {
    let chunkKey = Chunk.key(x, y);
    return storage.get(chunkKey, new Chunk())!;
  }

  setTile(x: i32, y: i32, tileId: string): void {
    checkMapBounds(x, y);
    let ox = x % CHUNK_SIZE;
    let oy = y % CHUNK_SIZE;
    this.nonce++;
    this.tiles[ox][oy] = tileId;
  }
}

@nearBindgen
export class TileInfo {
  x: i32;
  y: i32;
  tileId: string;
}

@nearBindgen
export class ChunkMap {
  chunks: i32[][];

  constructor() {
    this.chunks = new Array<Array<i32>>();
    for (let i = 0; i < CHUNK_COUNT; i++) {
      this.chunks[i] = new Array<i32>(CHUNK_COUNT);
      for (let j = 0; j < CHUNK_COUNT; j++) {
        this.chunks[i][j] = 0;
      }
    }
  }

  setChunk(x: i32, y: i32, chunk: Chunk): void {
    checkMapBounds(x, y);
    let cx = x / CHUNK_SIZE;
    let cy = y / CHUNK_SIZE;
    this.chunks[cx][cy] = chunk.nonce;
  }

  static get(): ChunkMap {
    return storage.get('chunkMap', new ChunkMap())!;
  }

  save(): void {
    storage.set('chunkMap', this);
  }

  setTile(x: i32, y: i32, tileId: string): void {
    let chunk = Chunk.get(x, y);
    chunk.setTile(x, y, tileId);
    storage.set(Chunk.key(x, y), chunk);
    this.setChunk(x, y, chunk);
    this.save();
  }

  setTiles(tiles: TileInfo[]): void {
    assert(tiles.length > 0, 'setting 0 tiles not supported');
    let firstTile = tiles[0];
    let chunk = Chunk.get(firstTile.x, firstTile.y);
    let chunkX = firstTile.x / CHUNK_SIZE;
    let chunkY = firstTile.y / CHUNK_SIZE;
    for (let i = 0; i < tiles.length; i++) {
      let tile = tiles[i];
      chunk.setTile(tile.x, tile.y, tile.tileId);
      assert(chunkX == tile.x / CHUNK_SIZE, "all tiles must be in same chunk");
      assert(chunkY == tile.y / CHUNK_SIZE, "all tiles must be in same chunk");
    }

    storage.set(Chunk.key(firstTile.x, firstTile.y), chunk);
    this.setChunk(firstTile.x, firstTile.y, chunk);
    this.save()
  }
}

function checkMapBounds(x: i32, y: i32): void {
  assert(x < CHUNK_COUNT * CHUNK_SIZE && x >= 0, 'x out of bounds');
  assert(y < CHUNK_COUNT * CHUNK_SIZE && y >= 0, 'y out of bounds');
}