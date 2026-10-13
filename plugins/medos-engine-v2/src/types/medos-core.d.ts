declare module 'medos-core' {
  export interface Logger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    debug?(message: string): void;
  }

  export interface Config {
    get(key: string): string | undefined;
  }

  export interface Request {
    body: any;
    params?: Record<string, string>;
    query?: Record<string, any>;
    url?: string;
  }

  export interface Response {
    status(code: number): Response;
    json(data: any): void;
    send?(data: any): void;
    writeHead?(status: number, headers?: any): void;
    end?(data?: any): void;
  }

  export type RouteHandler = (req: any, res: any) => Promise<void> | void;

  export interface PluginContext {
    logger?: Logger;
    db?: any;
    config?: Config;
    getService?<T>(name: string): T | undefined;
    registerService?(name: string, service: unknown): void;
    registerRoute(path: string, handler: unknown): void;
    registerRoute(method: string, path: string, handler?: unknown): void;
    broadcast?(eventType: string, payload: any): void;
    emitEvent?(eventType: string, payload: any): void;
    onEvent?(eventType: string, handler: (payload: any) => void): () => void;
  }

  export interface IPlugin {
    onLoad?(context: PluginContext): Promise<void> | void;
    onEnable?(): Promise<void> | void;
    onDisable?(): Promise<void> | void;
    onUnload?(): Promise<void> | void;
    onInit?(context: PluginContext): Promise<void>;
    onStop?(context?: PluginContext): Promise<void>;
  }
}
