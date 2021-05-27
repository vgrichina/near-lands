import { context, ContractPromiseBatch, storage, u128 } from "near-sdk-as";
import { Chunk, CHUNK_COUNT } from "./model";

const CONTRACT_ID = "near.lands";

@nearBindgen
export class Location {
    constructor(
        public x: u32,
        public y: u32) {
    }
}

@nearBindgen
export class ChunkMetaData {
    constructor(
        public x: u32,
        public y: u32,
        public owner: string,
        public price: u128) {
    }
}

export function getAllChunkMetadata_impl(): ChunkMetaData[] {
    const chunkMetadataMap: ChunkMetaData[] = [];
    for (let x = 0; x < CHUNK_COUNT; x++) {
        for (let y = 0; y < CHUNK_COUNT; y++) {
            chunkMetadataMap.push(getChunkMetaData(x, y));
        }
    }
    return chunkMetadataMap;
}

export function initChunkMetaData(chunk_x: u32, chunk_y: u32): ChunkMetaData {
    return new ChunkMetaData(chunk_x, chunk_y, CONTRACT_ID, u128.Zero);
}

export function sellChunk_impl(chunk_x: u32, chunk_y: u32, price: u128): void {
    const chunk = getChunkMetaData(chunk_x, chunk_y);
    chunk.price = price;
    saveChunkMetaData(chunk_x, chunk_y, chunk);
}

export function buyChunk_impl(chunk_x: u32, chunk_y: u32): void {

    const chunk = getChunkMetaData(chunk_x, chunk_y);
    assert(chunk.price > u128.Zero, "Chunk not for sell");
    assert(context.attachedDeposit == chunk.price, "Attached amount of NEAR is not correct.");
    const old_owner = chunk.owner;
    chunk.owner = context.predecessor;
    storage.set(Chunk.key(chunk_x, chunk_y), chunk);
    sendNear(old_owner, chunk.price);
}

function isChunkOwner(chunk_x: u32, chunk_y: u32) {
    assert(getChunkMetaData(chunk_x, chunk_y).owner == context.predecessor, "You are not the owner of this chunk");
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
    assert(x <= CHUNK_COUNT, "Chunk out of border");
    assert(y <= CHUNK_COUNT, "Chunk out of border");
}


function sendNear(recipient: string, amount: u128): void {
    ContractPromiseBatch.create(recipient).transfer(amount);
}