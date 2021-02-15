/*
 * This is an example of an AssemblyScript smart contract with two simple,
 * symmetric functions:
 *
 * 1. setGreeting: accepts a greeting, such as "howdy", and records it for the
 *    user (account_id) who sent the request
 * 2. getGreeting: accepts an account_id and returns the greeting saved for it,
 *    defaulting to "Hello"
 *
 * Learn more about writing NEAR smart contracts with AssemblyScript:
 * https://docs.near.org/docs/roles/developer/contracts/assemblyscript
 *
 */

import { context, ContractPromise, ContractPromiseBatch, logging, storage, u128 } from 'near-sdk-as'

const BERRIES_CONTRACT = 'berryclub.ek.near';
const NEAR_NOMINATION = u128.from('1000000000000000000000000');
const MIN_FRACTION = u128.from('1000000000000');
const MIN_BALANCE = NEAR_NOMINATION * u128.from(5);
const COMISSION_PERCENT = u128.from(5);

function assertOwner(): void {
    assert(context.predecessor == context.contractName, 'must be called by owner');
}

export function start(berries: u128): void {
    assertOwner();
    storage.set('berries', berries);
    storage.set('started', true);
}

export function stop(): void {
    assertOwner();

    storage.delete('started');
}

function assertPoolStarted(): void {
    assert(storage.contains('started'), 'pool not started yet');
}

@nearBindgen
class TransferRawArgs {
    receiver_id: string;
    amount: u128;
}

function withComission(price: u128): u128 {
    const hundred = u128.from(100);
    // TODO: Use muldiv when available
    return price / hundred * (hundred + COMISSION_PERCENT);
}

export function getBuyPrice(berries: u128): u128 {
    return getBuyPriceInternal(berries, context.accountBalance);
}

function getBuyPriceInternal(berries: u128, nearBalance: u128): u128 {
    const internalBerries = storage.getSome<u128>('berries') / MIN_FRACTION;
    berries = berries / MIN_FRACTION;
    assert(berries > u128.Zero, 'cannot exchange less than ' + MIN_FRACTION.toString() + ' berries');
    assert(berries < internalBerries, 'not enough berries in pool');

    const resultingBerries = internalBerries - berries;
    const currentNearAmount = (nearBalance - MIN_BALANCE) / MIN_FRACTION;
    const newNearAmount =  internalBerries * currentNearAmount / resultingBerries;
    const nearPrice = newNearAmount - currentNearAmount;
    return withComission(nearPrice * MIN_FRACTION);
}

export function buy(berries: u128): ContractPromise {
    assertPoolStarted();

    const nearPrice = getBuyPriceInternal(berries, context.accountBalance - context.attachedDeposit);
    assert(nearPrice <= context.attachedDeposit, 'not enough NEAR attached, required ' + nearPrice.toString());

    storage.set('berries', storage.getSome<u128>('berries') - berries);

    // TODO: Send back extra NEAR
    ContractPromiseBatch.create(context.predecessor)
        .transfer(context.attachedDeposit - nearPrice);

    // TODO: Do we need to lock somehow before transfer end?
    return ContractPromise.create<TransferRawArgs>(BERRIES_CONTRACT, 'transfer_raw',
        { receiver_id: context.predecessor, amount: berries }, 5000000000000, u128.One);
    // TODO: How to handle potential transfer errors to refund NEAR?
}

export function getSellPrice(nearAmount: u128): u128 {
    const currentNearAmount = (context.accountBalance - MIN_BALANCE) / MIN_FRACTION;
    const currentBerries = storage.getSome<u128>('berries') / MIN_FRACTION;
    nearAmount = nearAmount / MIN_FRACTION;
    assert(nearAmount > u128.Zero, 'cannot exchange less than ' + MIN_FRACTION.toString() + ' yoctoNEAR');
    assert(nearAmount < currentNearAmount, 'not enough NEAR in pool');

    const newNear = currentNearAmount - nearAmount;
    const newBerries = currentBerries * currentNearAmount / newNear;
    const berriesPrice = newBerries - currentBerries;

    return withComission(berriesPrice * MIN_FRACTION);
}

function sell(sender_id: string, berries: u128, nearAmount: u128): u128 {
    assertPoolStarted();

    const berriesPrice = getSellPrice(nearAmount);
    assert(berriesPrice <= berries, 'not enough berries attached, required ' + berriesPrice.toString());

    // TODO: Do we need to lock somehow before transfer end?
    storage.set('berries', storage.getSome<u128>('berries') + berriesPrice);
    // TODO: Wait somehow for this promise?
    ContractPromiseBatch.create(sender_id).transfer(nearAmount);

    return berriesPrice;
}

export function getSellPriceBerries(berries: u128): u128 {
    const currentNearAmount = (context.accountBalance - MIN_BALANCE) / MIN_FRACTION;
    const currentBerries = storage.getSome<u128>('berries') / MIN_FRACTION;
    assert(berries != u128.Zero, 'berries to exchange should be greater than 0');

    const newBerries = currentBerries + berries;
    const newNear = currentBerries * currentNearAmount / newBerries;
    const nearPrice = newNear - currentNearAmount;

    return withComission(nearPrice * MIN_FRACTION);
}

function sellBerries(sender_id: string, berries: u128, nearAmount: u128): u128 {
    assertPoolStarted();

    const nearPrice = getSellPrice(nearAmount);
    assert(nearPrice >= nearAmount, nearPrice.toString() + ' is smaller than required ' + nearAmount.toString() + ' yoctoNEAR');

    storage.set('berries', storage.getSome<u128>('berries') + berries);
    // TODO: Wait somehow for this promise?
    ContractPromiseBatch.create(sender_id).transfer(nearPrice);

    return nearPrice;
}

@nearBindgen
class WithdrawFromVaultArgs {
    // TODO: Sort out u32/u64/u53 situation
    vault_id: u32;
    receiver_id: string;
    amount: u128;
}

function withdrawFromVault(vault_id: u32, receiver_id: string, amount: u128): ContractPromise {
    return ContractPromise.create<WithdrawFromVaultArgs>(BERRIES_CONTRACT,
        'withdraw_from_vault', { receiver_id, amount, vault_id }, 5000000000000);
}

export function on_receive_with_vault(sender_id: string, amount: u128, vault_id: u32, payload: String): ContractPromise {
    assert(context.predecessor == BERRIES_CONTRACT, "can only be called from token contract");

    if (payload.startsWith('sell:')) {
        const parts = payload.split(':');
        const nearAmount = u128.from(parts[1]);
        const berries = sell(sender_id, amount, nearAmount);
        return withdrawFromVault(vault_id, context.contractName, berries);
    }

    if (payload.startsWith('sellBerries:')) {
        const parts = payload.split(':');
        const nearAmount = u128.from(parts[1]);
        sellBerries(sender_id, amount, nearAmount);
        return withdrawFromVault(vault_id, context.contractName, amount);
    }

    if (payload == 'deposit') {
        assert(!storage.contains('started'), "deposit not supported after pool is started");
        storage.set('berries', storage.get('berries', u128.from(0))! + amount);
        return withdrawFromVault(vault_id, context.contractName, amount);
    }

    assert(false, 'unexpected payload: ' + payload);
    // NOTE: Never happens, but is return value is required
    return withdrawFromVault(vault_id, sender_id, amount);
}

