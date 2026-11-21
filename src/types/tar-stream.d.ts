/**
 * Minimal local type declaration for `tar-stream` so the build doesn't depend
 * on the (version-volatile) @types/tar-stream package. The runtime module is
 * resolved normally from node_modules; this shim only supplies types.
 */
declare module "tar-stream" {
  export interface TarHeader {
    name: string;
    type: string;
    size?: number;
    mode?: number;
    mtime?: number;
  }

  export interface TarEntry extends NodeJS.ReadableStream {
    on(event: "data", listener: (chunk: Buffer) => void): this;
    on(event: "end", listener: () => void): this;
    resume(): this;
  }

  export interface ExtractStream extends NodeJS.WritableStream {
    on(event: "entry", listener: (header: TarHeader, entry: TarEntry, next: () => void) => void): this;
    on(event: "finish", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
  }

  export function extract(): ExtractStream;
}
