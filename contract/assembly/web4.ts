
import { context, ContractPromise, ContractPromiseBatch, logging, storage, u128, util } from 'near-sdk-as'

@nearBindgen
export class Web4Request {
    accountId: string | null;
    path: string;
    params: Map<string, string>;
    query: Map<string, Array<string>>;
    preloads: Map<string, Web4Response>;
}

@nearBindgen
export class Web4Response {
    contentType: string;
    body: Uint8Array;
    bodyUrl: string;
    preloadUrls: string[] = [];
}

export class HtmlAttributes {
    id: string | null;
    name: string | null;
    class: string | null;
    style: string | null;

    toString(): string {
        let result = "";
        if (this.id) {
            result += "id=";
            result += this.id!;
        }
        if (this.name) {
            result += "name=";
            result += this.name!;
        }
        if (this.class) {
            result += "class=";
            result += this.class!;
        }
        if (this.style) {
            result += "style=";
            result += this.style!;
        }
        return result;
    }
}

export class HtmlFormAttributes extends HtmlAttributes {
    action: string | null;
    method: string = "POST";

    toString(): string {
        let result = super.toString();
        if (this.action) {
            result += "action=";
            result += this.action!;
        }
        if (this.method) {
            result += "method=";
            result += this.method;
        }
        return result;
    }
}

export function form(attrs: HtmlFormAttributes, content: string[] | null = null): string {
    return '<form ' + attrs.toString() + '>' + (content ? content.join('\n') : '') + '</form>';
}

export function textarea(attrs: HtmlAttributes, content: string[] | null = null): string {
    return '<textarea ' + attrs.toString() + '>' + (content ? content.join('\n') : '') + '</textarea>';
}

export function button(attrs: HtmlAttributes, content: string[] | null = null): string {
    return '<button ' + attrs.toString() + '>' + (content ? content.join('\n') : '') + '</button>';
}

export function htmlResponse(text: string): Web4Response {
    return { contentType: 'text/html; charset=UTF-8', body: util.stringToBytes(text) };
}

export function svgResponse(text: string): Web4Response {
    return { contentType: 'image/svg+xml; charset=UTF-8', body: util.stringToBytes(text) };
}

export function pngResponse(data: Uint8Array): Web4Response {
    return { contentType: 'image/png', body: data };
}

export function preloadUrls(urls: string[]): Web4Response {
    return { preloadUrls: urls };
}

export function bodyUrl(url: string): Web4Response {
    return { bodyUrl: url };
}
