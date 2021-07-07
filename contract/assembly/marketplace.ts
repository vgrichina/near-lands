import { context, ContractPromiseBatch, storage, u128 } from "near-sdk-as";

const PARCEL_COUNT = 8;

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
export function getAllLandParcel_impl(): LandParcel[] {
    const parcel: LandParcel[] = [];
    for (let x = 0; x < PARCEL_COUNT; x++) {
        for (let y = 0; y < PARCEL_COUNT; y++) {
            parcel.push(getLandParcel(x, y));
        }
    }
    return parcel;
}

export function initLandParcel(parcel_x: i32, parcel_y: i32): LandParcel {
    return new LandParcel(parcel_x, parcel_y, context.contractName, u128.Zero);
}

export function offerParcel_impl(parcel_x: i32, parcel_y: i32, price: u128): void {
    const parcel = getLandParcel(parcel_x, parcel_y);
    parcel.price = price;
    saveLandParcel(parcel_x, parcel_y, parcel);
}

export function buyParcel_impl(parcel_x: i32, parcel_y: i32): void {

    const parcel = getLandParcel(parcel_x, parcel_y);
    assert(parcel.price > u128.Zero, "Parcel not for sell");
    assert(context.attachedDeposit == parcel.price, "Attached amount of NEAR is not correct.");
    const old_owner = parcel.owner;
    parcel.owner = context.predecessor;
    storage.set(LandParcel.key(parcel_x, parcel_y), parcel);
    sendNear(old_owner, parcel.price);
}

function assertParcelOwner(parcel_x: i32, parcel_y: i32): void {
    assert(getLandParcel(parcel_x, parcel_y).owner == context.predecessor, "You are not the owner of this parcel");
}

export function getLandParcel(x: i32, y: i32): LandParcel {
    assertWorldSize(x, y);
    return storage.get<LandParcel>(LandParcel.key(x, y), initLandParcel(x, y))!;
}

export function saveLandParcel(x: i32, y: i32, data: LandParcel): void {
    assertParcelOwner(x, y);
    assertWorldSize(x, y);
    storage.set(LandParcel.key(x, y), data);
}

function assertWorldSize(x: i32, y: i32): void {
    assert(x <= PARCEL_COUNT, "Parcel out of border");
    assert(y <= PARCEL_COUNT, "Parcel out of border");
}


function sendNear(recipient: string, amount: u128): void {
    ContractPromiseBatch.create(recipient).transfer(amount);
}