// Generated by typings
// Source: https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/56295f5058cac7ae458540423c50ac2dcf9fc711/istanbul/istanbul.d.ts
declare module "istanbul" {
    namespace istanbul {
        interface Istanbul {
            new (options?: any): Istanbul;
            Collector: Collector;
            config: Config;
            ContentWriter: ContentWriter;
            FileWriter: FileWriter;
            hook: Hook;
            Instrumenter: Instrumenter;
            Report: Report;
            Reporter: Reporter;
            Store: Store;
            utils: ObjectUtils;
            VERSION: string;
            Writer: Writer;
        }

        interface Collector {
            new (options?: any): Collector;
            add(coverage: any, testName?: string): void;
        }

        interface Config {}

        interface ContentWriter {}

        interface FileWriter {}

        interface Hook {
            hookRequire(matcher: any, transformer: any, options: any): void;
            unhookRequire(): void;
        }

        interface Instrumenter {
            new (options?: any): Instrumenter;
            instrumentSync(code: string, filename: string): string;
        }

        interface Report {}

        interface Configuration {
            new (obj: any, overrides: any): Configuration;
        }

        interface Reporter {
            new (cfg?: Configuration, dir?: string): Reporter;
            add(fmt: string): void;
            addAll(fmts: Array<string>): void;
            write(collector: Collector, sync: boolean, callback: Function): void;
        }

        interface Store {}

        interface ObjectUtils {}

        interface Writer {}
    }

    var istanbul: istanbul.Istanbul;

    export = istanbul;
}
