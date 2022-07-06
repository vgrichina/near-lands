// NOTE: Ported from https://github.com/wheany/js-png-encoder/blob/master/generatepng.js

// 0x78, 7 = 2^(7+8) = 32768 window size (CMF)
//       8 = deflate compression
// 0x01, (00 0 00001) (FLG)
// bits 0 to 4  FCHECK  (check bits for CMF and FLG)
// bit  5       FDICT   (preset dictionary)
// bits 6 to 7  FLEVEL  (compression level)

function typedarray<AT, T>(arr: T[]): AT {
    let result = new AT(arr.length);
    for (let i = 0; i < arr.length; i++) {
        result[i] = arr[i];
    }
    return result;
}

const DEFLATE_METHOD: u8[] = [0x78, 0x01];
const CRC_TABLE = make_crc_table();
const SIGNATURE: u8[] = [137, 80, 78, 71, 13, 10, 26, 10];
const NO_FILTER: u8[] = [0];

function make_crc_table(): u32[] {
    let result: u32[] = [];
    let c: u32

    for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) {
            if (c & 1) {
                c = 0xedb88320 ^ (c >>> 1);
            } else {
                c = c >>> 1;
            }
        }
        result.push(c);
    }

    return result;
};

function inflateStore(data: u8[]): u8[] {
    const MAX_STORE_LENGTH = 65535;
    let storeBuffer: u8[] = [];
    let remaining: i32;

    for (let i = 0; i < data.length; i += MAX_STORE_LENGTH) {
        remaining = data.length - i;
        let blockType = [];

        // TODO: More efficient concatenation

        if (remaining <= MAX_STORE_LENGTH) {
            storeBuffer = storeBuffer.concat([0x01]);
        } else {
            storeBuffer = storeBuffer.concat([0x00]);
        }
        // little-endian
        storeBuffer = storeBuffer.concat([(remaining & 0xFF) as u8, (remaining & 0xFF00) >>> 8 as u8]);
        storeBuffer = storeBuffer.concat([((~remaining) & 0xFF) as u8, ((~remaining) & 0xFF00) >>> 8 as u8]);

        storeBuffer = storeBuffer.concat(data.slice(i, i + remaining));
    }

    return storeBuffer;
}

function adler32(data: u8[]): u32 {
    const MOD_ADLER = 65521;
    let a: u32 = 1;
    let b: u32 = 0;

    for (let i = 0; i < data.length; i++) {
        a = (a + data[i]) % MOD_ADLER;
        b = (b + a) % MOD_ADLER;
    }

    return (b << 16) | a;
}

function update_crc(crc: u32, buf: u8[]): u32 {
    let c = crc;
    let b: u8;

    for (let n = 0; n < buf.length; n++) {
        b = buf[n];
        c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    }
    return c;
}

function crc(buf: u8[]): u32 {
    return update_crc(0xffffffff, buf) ^ 0xffffffff;
}

function dwordAsBytes(dword: u32): u8[] {
    return [(dword & 0xFF000000) >>> 24 as u8, (dword & 0x00FF0000) >>> 16 as u8, (dword & 0x0000FF00) >>> 8 as u8, (dword & 0x000000FF) as u8];
}

function createChunk(length: u32, type: u8[], data: u8[]): u8[] {
    const CRC = crc(type.concat(data));

    return dwordAsBytes(length)
        .concat(type)
        .concat(data)
        .concat(dwordAsBytes(CRC))
}

function asciiBytesFromString(str: string): u8[] {
    let result: u8[] = [];
    for (let i = 0; i < str.length; i++) {
        // TODO: Fail explicitly if not ASCII
        result.push(<u8>str.charCodeAt(i));
    }
    return result;
}

function createIHDR(width: u32, height: u32): u8[] {
    let IHDRdata = dwordAsBytes(width)
        .concat(dwordAsBytes(height));

    IHDRdata = IHDRdata.concat([
        // bit depth
        8,
        // color type: 6=truecolor with alpha
        6,
        // compression method: 0=deflate, only allowed value
        0,
        // filtering: 0=adaptive, only allowed value
        0,
        // interlacing: 0=none
        0
    ]);

    return createChunk(13, asciiBytesFromString('IHDR'), IHDRdata);
}

const IEND = createChunk(0, asciiBytesFromString('IEND'), []);

export function generatePNG(width: u32, height: u32, rgba: u8[]): u8[] {
    let IHDR = createIHDR(width, height);
    let scanlines: u8[] = [];

    for (let y = 0; y < rgba.length; y += width * 4) {
        let scanline = NO_FILTER;
        scanline = scanline.concat(rgba.slice(y, y + width * 4));
        scanlines = scanlines.concat(scanline);
    }

    let compressedScanlines = DEFLATE_METHOD.concat(inflateStore(scanlines)).concat(dwordAsBytes(adler32(scanlines)));

    let IDAT = createChunk(compressedScanlines.length, asciiBytesFromString('IDAT'), compressedScanlines);

    return SIGNATURE.concat(IHDR).concat(IDAT).concat(IEND);
};
