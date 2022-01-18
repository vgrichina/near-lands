import { storage, u128, util, logging } from "near-sdk-as";
import * as marketplace from "./marketplace";

import { Chunk, ChunkMap, TileInfo, LandParcel, CHUNK_SIZE, CHUNK_COUNT, PARCEL_COUNT } from "./model"

import { Web4Request, Web4Response, bodyUrl, svgResponse, htmlResponse } from "./web4";

export function getLandParcelRange(x: i32, y: i32, width: i32, height: i32): LandParcel[] {
    return marketplace.getLandParcelRange(x, y, width, height);
}

export function offerChunk(x: u32, y: u32, price: string): void {
    marketplace.offerParcel(x, y, u128.from(price));
}

export function buyParcel(x: u32, y: u32): void {
    marketplace.buyParcel(x, y);
}

export function setTiles(tiles: TileInfo[]): void {
    assert(tiles.length > 0, 'setting 0 tiles not supported');

    let firstTile = tiles[0];
    let parcelX = firstTile.x / CHUNK_SIZE / CHUNK_COUNT;
    let parcelY = firstTile.y / CHUNK_SIZE / CHUNK_COUNT;
    let map = ChunkMap.get(parcelX, parcelY);
    map.setTiles(tiles);
}

export function getChunk(x: i32, y: i32): Chunk {
    return Chunk.get(x, y);
}

export function getParcelNonces(x: i32, y: i32): i32[][] {
    return ChunkMap.get(x, y).chunkNonces;
}

function renderChunk(x: i32, y: i32): string {
    const pieces: string[] = [];
    const chunk = Chunk.get(x, y);
    for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
            const tileId = util.parseFromString<i32>(chunk.tiles[x][y]);
            let fillColor = 'black';
            if (tileId >= 48 && tileId < 66) {
                fillColor = '#477f3f';
            } else if (tileId >= 66 && tileId < 66 + 18) {
                fillColor = '#336a95';
            } else if ([30, 31, 37, 38, 39, 45, 46, 47].includes(tileId)) {
                fillColor = '#7a715f';
            } else if (tileId > 0) {
                fillColor = '#f8d29c';
            }
            pieces.push(`<rect x="${x}" y="${y}" width="1" height="1" style="fill:${fillColor};" />`);
        }
    }
    return pieces.join('\n');
}

function renderParcel(x: i32, y: i32): string {
    const chunks: string[] = [];
    for (let i = 0; i < CHUNK_COUNT; i++) {
        for (let j = 0; j < CHUNK_COUNT; j++) {
            chunks.push(`<svg x="${i * CHUNK_SIZE}" y="${j * CHUNK_SIZE}">${renderChunk(i + x * CHUNK_COUNT, j + y * CHUNK_COUNT)}</svg>`);
        }
    }
    return chunks.join('\n');
}

export function web4_get(request: Web4Request): Web4Response {
    logging.log(`web4_get: ${request.path}`);

    if (request.path.startsWith('/chunk')) {
        logging.log('serve chunk');
        const parts = request.path.split('/');
        assert(parts.length == 3, 'Unrecognized chunk path: ' + request.path);

        const chunkId = parts[2];
        const chunkCoords = chunkId.split(',');
        assert(chunkCoords.length == 2, 'Unrecognized chunk ID: ' + chunkId);

        const chunk = renderChunk(util.parseFromString<i32>(chunkCoords[0]), util.parseFromString<i32>(chunkCoords[1]));

        return svgResponse(`<svg
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            version="1.1" width="${CHUNK_SIZE}" height="${CHUNK_SIZE}" viewBox="0 0 ${CHUNK_SIZE} ${CHUNK_SIZE}">

            ${chunk}
        </svg>`);
    }

    if (request.path.startsWith('/parcel')) {
        logging.log('serve parcel')
        const parts = request.path.split('/');
        assert(parts.length == 3, 'Unrecognized parcel path: ' + request.path);

        const parcelId = parts[2];
        const parcelCoords = parcelId.split(',');
        assert(parcelCoords.length == 2, 'Unrecognized parcel ID: ' + parcelId);

        const parcel = renderParcel(util.parseFromString<i32>(parcelCoords[0]), util.parseFromString<i32>(parcelCoords[1]));
        return svgResponse(`<svg
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            version="1.1"
            width="${CHUNK_SIZE * CHUNK_COUNT}"
            height="${CHUNK_SIZE * CHUNK_COUNT}"
            viewBox="0 0 ${CHUNK_SIZE * CHUNK_COUNT} ${CHUNK_SIZE * CHUNK_COUNT}">

            ${parcel}
        </svg>`);
    }

    if (request.path.startsWith('/minimap')) {
        const lines: string[] = [];
        for (let j = 0; j < PARCEL_COUNT; j++) {
            lines.push('<div>');
            for (let i = 0; i < PARCEL_COUNT; i++) {
                lines.push(`<img src="/parcel/${i},${j}">`);
            }
            lines.push('</div>');
        }
        return htmlResponse(lines.join('\n'));
    }

    // Serve everything from IPFS for now
    logging.log('serve from IPFS');
    return bodyUrl(`ipfs://bafybeigmxmdtdjybphm3clklrtek35irwwf7bkojx7qjrwn2wlkn5sn66m${request.path}`);
}