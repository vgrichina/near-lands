import { context, ContractPromiseBatch, storage, u128 } from "near-sdk-as";
import { Chunk, CHUNK_SIZE } from "./model";

export function sellChunk_impl(x: u32, y: u32, price: u128): void {
    const chunk_location = getChunkLocationByGlobalCoords(x, y);
    const chunk = Chunk.get(chunk_location.x, chunk_location.y);
    chunk.price = price;
    storage.set(Chunk.key(chunk_location.x, chunk_location.y), chunk);
}

export function buyChunk_impl(x: u32, y: u32): void {
    const chunk_location = getChunkLocationByGlobalCoords(x, y);
    const chunk = Chunk.get(chunk_location.x, chunk_location.y);
    assert(chunk.price > u128.Zero, "Chunk not for sell");
    assert(context.attachedDeposit == chunk.price, "Attached amount of NEAR is not correct.");
    const old_owner = chunk.owner;
    chunk.owner = context.predecessor;
    storage.set(Chunk.key(chunk_location.x, chunk_location.y), chunk);
    sendNear(old_owner, chunk.price);
}

function isChunkOwner(x: u32, y: u32) {
    const chunk_location = getChunkLocationByGlobalCoords(x, y);
    assert(Chunk.get(chunk_location.x, chunk_location.y).owner == context.predecessor, "You are not the owner of this chunk");
}

function getChunkLocationByGlobalCoords(x: u32, y: u32): { x: i32, y: i32 } {
    return { x: x / CHUNK_SIZE, y: y / CHUNK_SIZE };
}

function sendNear(recipient: string, amount: u128): void {
    ContractPromiseBatch.create(recipient).transfer(amount);
}