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

    static create(x: i32, y: i32): LandParcel {
        return new LandParcel(x, y, context.contractName, u128.Zero);
    }

    static key(x: i32, y: i32): string {
        return x.toString() + '_' + y.toString();
    }

    static get(x: i32, y: i32): LandParcel {
        assertWorldSize(x, y);
        return storage.get<LandParcel>(LandParcel.key(x, y), LandParcel.create(x, y))!;
    }

    save(x: i32, y: i32): void {
        assertParcelOwner(x, y);
        assertWorldSize(x, y);
        this.x = x;
        this.y = y;
        storage.set(LandParcel.key(x, y), this);
    }
}

// TODO: Probably needs to take a range instead of returning all?
export function getLandParcelRange(x: i32, y: i32, width: i32, height: i32): LandParcel[] {
    const parcel: LandParcel[] = [];
    for (let i = 0; i < x + width; i++) {
        for (let j = 0; j < y + height; j++) {
            parcel.push(LandParcel.get(i, j));
        }
    }
    return parcel;
}

export function offerParcel(x: i32, y: i32, price: u128): void {
    const parcel = LandParcel.get(x, y);
    parcel.price = price;
    parcel.save(x, y);
}

export function buyParcel(x: i32, y: i32): void {
    const parcel = LandParcel.get(x, y);
    assert(parcel.price > u128.Zero, "Parcel not for sell");
    assert(context.attachedDeposit == parcel.price, "Attached amount of NEAR is not correct.");
    const old_owner = parcel.owner;
    parcel.owner = context.predecessor;
    storage.set(LandParcel.key(x, y), parcel);
    sendNear(old_owner, parcel.price);
}

function assertParcelOwner(x: i32, y: i32): void {
    assert(LandParcel.get(x, y).owner == context.predecessor, "You are not the owner of this parcel");
}

function assertWorldSize(x: i32, y: i32): void {
    assert(x < WORLD_RADIUS && x >= -WORLD_RADIUS, "Parcel out of border");
    assert(y < WORLD_RADIUS && y >= -WORLD_RADIUS, "Parcel out of border");
}


function sendNear(recipient: string, amount: u128): void {
    ContractPromiseBatch.create(recipient).transfer(amount);
}