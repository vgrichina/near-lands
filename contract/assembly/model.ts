// @nearfile

const CHUNK_SIZE = 16;
const CHUNK_COUNT = 5;
const START_COLOR = "FFFFFF";

export class Chunk {
  nonce: i32;
  rgb: string[][];

  constructor() {
    this.rgb = new Array<Array<string>>(CHUNK_SIZE);
    for (let i = 0; i < CHUNK_SIZE; i++) {
      this.rgb[i] = new Array<string>(CHUNK_SIZE);
      for (let j = 0; j < CHUNK_SIZE; j++) {
        this.rgb[i][j] = START_COLOR;
      }
    }
  }

  static key(x: i32, y: i32): string {
    checkBounds(x, y);
    let cx = x / CHUNK_SIZE;
    let cy = y / CHUNK_SIZE;
    return 'chunk:' + cx.toString() + ':' + cy.toString();
  }

  setPixel(x: i32, y: i32, rgb: string): void {
    checkBounds(x, y);
    let ox = x % CHUNK_SIZE;
    let oy = y % CHUNK_SIZE;
    this.nonce++;
    this.rgb[ox][oy] = rgb;
  }
}

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
    checkBounds(x, y);
    let cx = x / CHUNK_SIZE;
    let cy = y / CHUNK_SIZE;
    this.chunks[cx][cy] = chunk.nonce;
  }
}

function checkBounds(x: i32, y: i32): void {
  assert(x < CHUNK_COUNT * CHUNK_SIZE && x >= 0, 'x out of bounds');
  assert(y < CHUNK_COUNT * CHUNK_SIZE && y >= 0, 'y out of bounds');
}