import { context, ContractPromiseBatch, storage, u128 } from "near-sdk-as";

const CONTRACT_ID = "";
const MAP_MAX_Y_CHUNKS = 8;
const MAP_MAX_X_CHUNKS = 8;

@nearBindgen
export class ChunkMetaData {

    constructor(
        public x: u32,
        public y: u32,
        public owner: string,
        public price: u128) {
    }
}

export function sellChunk(x: u32, y: u32, price: u128): void {
    const chunk = getChunkMetaData(x, y);
    chunk.price = price;
    saveChunkMetaData(x, y, chunk);
}


export function initChunkMetaData(x: u32, y: u32): ChunkMetaData {
    return new ChunkMetaData(x, y, CONTRACT_ID, u128.Zero);
}

export function getChunkMetaData(x: u32, y: u32): ChunkMetaData {
    assertChunkSize(x, y);
    return storage.get<ChunkMetaData>(x + "_" + y, initChunkMetaData(x, y))!;
}

export function saveChunkMetaData(x: u32, y: u32, data: ChunkMetaData): void {
    isChunkOwner(x, y);
    assertChunkSize(x, y);
    storage.set(x.toString() + "_" + y.toString(), data);
}

function assertChunkSize(x: u32, y: u32) {
    assert(x <= MAP_MAX_X_CHUNKS, "Chunk out of border");
    assert(y <= MAP_MAX_Y_CHUNKS, "Chunk out of border");
}

function isChunkOwner(x: u32, y: u32) {
    assert(getChunkMetaData(x, y).owner == context.predecessor, "You are not the owner of this chunk");
}


export function sendNear(recipient: string, amount: u128): void {
    ContractPromiseBatch.create(recipient).transfer(amount);
}