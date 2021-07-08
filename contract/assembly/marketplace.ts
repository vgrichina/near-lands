import { context, ContractPromiseBatch, storage, u128 } from "near-sdk-as";

const WORLD_RADIUS = 8;

@nearBindgen
export class LandParcel {
    constructor(
        public x: i32,
        public y: i32,
        public owner: string,
        public price: u128) {
    }

    static key(x: i32, y: i32): string {
        return x.toString() + '_' + y.toString();
    }
}

// TODO: Probably needs to take a range instead of returning all?
export function getLandParcelRange(x: i32, y: i32, width: i32, height: i32): LandParcel[] {
    const parcel: LandParcel[] = [];
    for (let i = 0; i < x + width; i++) {
        for (let j = 0; j < y + height; j++) {
            parcel.push(getLandParcel(i, j));
        }
    }
    return parcel;
}

export function initLandParcel(x: i32, y: i32): LandParcel {
    return new LandParcel(x, y, context.contractName, u128.Zero);
}

export function offerParcel(x: i32, y: i32, price: u128): void {
    const parcel = getLandParcel(x, y);
    parcel.price = price;
    saveLandParcel(x, y, parcel);
}

export function buyParcel(x: i32, y: i32): void {

    const parcel = getLandParcel(x, y);
    assert(parcel.price > u128.Zero, "Parcel not for sell");
    assert(context.attachedDeposit == parcel.price, "Attached amount of NEAR is not correct.");
    const old_owner = parcel.owner;
    parcel.owner = context.predecessor;
    storage.set(LandParcel.key(x, y), parcel);
    sendNear(old_owner, parcel.price);
}

function assertParcelOwner(x: i32, y: i32): void {
    assert(getLandParcel(x, y).owner == context.predecessor, "You are not the owner of this parcel");
}

function getLandParcel(x: i32, y: i32): LandParcel {
    assertWorldSize(x, y);
    return storage.get<LandParcel>(LandParcel.key(x, y), initLandParcel(x, y))!;
}

function saveLandParcel(x: i32, y: i32, data: LandParcel): void {
    assertParcelOwner(x, y);
    assertWorldSize(x, y);
    storage.set(LandParcel.key(x, y), data);
}

function assertWorldSize(x: i32, y: i32): void {
    assert(x < WORLD_RADIUS && x >= -WORLD_RADIUS, "Parcel out of border");
    assert(y < WORLD_RADIUS && y >= -WORLD_RADIUS, "Parcel out of border");
}


function sendNear(recipient: string, amount: u128): void {
    ContractPromiseBatch.create(recipient).transfer(amount);
}