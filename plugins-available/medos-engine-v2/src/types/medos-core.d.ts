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
  }

  export interface Response {
    status(code: number): Response;
    json(data: any): void;
    send?(data: any): void;
  }

  export type RouteHandler = (req: Request, res: Response) => Promise<void> | void;

  export interface PluginContext {
    logger: Logger;
    db: any;
    config: Config;
    registerRoute(method: string, path: string, handler: RouteHandler): void;
    broadcast?(eventType: string, payload: any): void;
    emitEvent?(eventType: string, payload: any): void;
    onEvent?(eventType: string, handler: (payload: any) => void): () => void;
  }

  export interface IPlugin {
    onInit(context: PluginContext): Promise<void>;
    onStop(context: PluginContext): Promise<void>;
  }
}
