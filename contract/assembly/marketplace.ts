import { context, ContractPromiseBatch, storage, u128 } from "near-sdk-as";
import { Chunk, CHUNK_SIZE } from "./model";

export function sellChunk_impl(chunk_x: u32, chunk_y: u32, price: u128): void {

    const chunk = Chunk.get(chunk_x, chunk_y);
    chunk.price = price;
    storage.set(Chunk.key(chunk_x, chunk_y), chunk);
}

export function buyChunk_impl(chunk_x: u32, chunk_y: u32): void {

    const chunk = Chunk.get(chunk_x, chunk_y);
    assert(chunk.price > u128.Zero, "Chunk not for sell");
    assert(context.attachedDeposit == chunk.price, "Attached amount of NEAR is not correct.");
    const old_owner = chunk.owner;
    chunk.owner = context.predecessor;
    storage.set(Chunk.key(chunk_x, chunk_y), chunk);
    sendNear(old_owner, chunk.price);
}

function isChunkOwner(chunk_x: u32, chunk_y: u32) {
    assert(Chunk.get(chunk_x, chunk_y).owner == context.predecessor, "You are not the owner of this chunk");
}

function sendNear(recipient: string, amount: u128): void {
    ContractPromiseBatch.create(recipient).transfer(amount);
}