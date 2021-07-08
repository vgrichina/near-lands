import { storage, context, u128 } from "near-sdk-as";

const CHUNK_SIZE = 16;
export const CHUNK_COUNT = 4;
const START_TILE_ID = "-1";

export const WORLD_RADIUS = 8;

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
    return 'chunk:' + x.toString() + ':' + y.toString();
  }

  static get(x: i32, y: i32): Chunk {
    let chunkKey = Chunk.key(x, y);
    return storage.get(chunkKey, new Chunk())!;
  }

  setTile(x: i32, y: i32, tileId: string): void {
    let ox = x % CHUNK_SIZE;
    let oy = y % CHUNK_SIZE;
    assert(ox < CHUNK_SIZE && ox >= 0, 'x out of bounds');
    assert(oy < CHUNK_SIZE && oy >= 0, 'y out of bounds');
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
  x: i32;
  y: i32;
  chunkNonces: i32[][];

  constructor() {
    this.initNonces();
  }

  private initNonces(): void {
    this.chunkNonces = new Array<Array<i32>>();
    for (let i = 0; i < CHUNK_COUNT; i++) {
      this.chunkNonces[i] = new Array<i32>(CHUNK_COUNT);
      for (let j = 0; j < CHUNK_COUNT; j++) {
        this.chunkNonces[i][j] = 0;
      }
    }
  }

  setChunk(x: i32, y: i32, chunk: Chunk): void {
    x = x % CHUNK_COUNT;
    y = y % CHUNK_COUNT;
    checkMapBounds(x, y);
    this.chunkNonces[x][y] = chunk.nonce;
  }

  static key(x: i32, y: i32): string {
    assertWorldBounds(x, y);
    return 'parcel:' + x.toString() + ':' + y.toString() + ':chunks';
  }

  static get(x: i32, y: i32): ChunkMap {
    const result = storage.get(ChunkMap.key(x, y), new ChunkMap())!;
    if (!result.chunkNonces) {
      result.initNonces();
    }
    result.x = x;
    result.y = y;
    return result;
  }

  save(): void {
    storage.set(ChunkMap.key(this.x, this.y), this);
  }

  setTile(x: i32, y: i32, tileId: string): void {
    let cx = x / CHUNK_SIZE;
    let cy = y / CHUNK_SIZE;
    let chunk = Chunk.get(cx, cy);
    chunk.setTile(x, y, tileId);
    storage.set(Chunk.key(cx, cy), chunk);
    this.setChunk(cx, cy, chunk);
    this.save();

    this.updateParcelNonce();
  }

  setTiles(tiles: TileInfo[]): void {
    assert(tiles.length > 0, 'setting 0 tiles not supported');

    let firstTile = tiles[0];
    let chunkX = firstTile.x / CHUNK_SIZE;
    let chunkY = firstTile.y / CHUNK_SIZE;
    let chunk = Chunk.get(chunkX, chunkY);
    for (let i = 0; i < tiles.length; i++) {
      let tile = tiles[i];
      chunk.setTile(tile.x, tile.y, tile.tileId);
      assert(chunkX == tile.x / CHUNK_SIZE, "all tiles must be in same chunk");
      assert(chunkY == tile.y / CHUNK_SIZE, "all tiles must be in same chunk");
    }

    storage.set(Chunk.key(chunkX, chunkY), chunk);
    this.setChunk(chunkX, chunkY, chunk);
    this.save()

    this.updateParcelNonce();
  }

  private updateParcelNonce(): void {
    const parcel = LandParcel.get(this.x, this.y);
    parcel.nonce++;
    parcel.save();
  }
}

function checkMapBounds(x: i32, y: i32): void {
  assert(x < CHUNK_COUNT && x >= 0, 'x out of bounds');
  assert(y < CHUNK_COUNT && y >= 0, 'y out of bounds');
}

@nearBindgen
export class LandParcel {
  nonce: u64 = 0;

  constructor(
    public x: i32,
    public y: i32,
    public owner: string,
    public price: u128) {
  }

  static create(x: i32, y: i32): LandParcel {
    return new LandParcel(x, y, context.contractName, u128.Zero);
  }

  static key(x: i32, y: i32): string {
    assertWorldBounds(x, y);
    return x.toString() + '_' + y.toString();
  }

  static get(x: i32, y: i32): LandParcel {
    return storage.get<LandParcel>(LandParcel.key(x, y), LandParcel.create(x, y))!;
  }

  save(): void {
    storage.set(LandParcel.key(this.x, this.y), this);
  }

  assertParcelOwner(): void {
    assert(this.owner == context.predecessor, "You are not the owner of this parcel");
  }
}

function assertWorldBounds(x: i32, y: i32): void {
  assert(x < WORLD_RADIUS && x >= -WORLD_RADIUS, "Parcel out of border");
  assert(y < WORLD_RADIUS && y >= -WORLD_RADIUS, "Parcel out of border");
}

