/**
 * @file core-interfaces.ts
 * @description Grundlegende Typisierungen für die MedOS Yeti Plugin-Architektur.
 */

/**
 * ManifestSchema definiert die Struktur der `plugin.json`.
 * Beschreibt Metadaten und Abhängigkeiten des Plugins.
 */
export interface ManifestSchema {
  name: string;
  version: string;
  description?: string;
  dependencies?: Record<string, string>;
  entry: string;
}

/**
 * PluginContext wird jedem Plugin zur Laufzeit injiziert.
 * Gewährt kontrollierten Zugriff auf die Kern-APIs des Microkernels.
 */
export interface PluginContext {
  registerService(name: string, service: unknown): void;
  getService<T>(name: string): T | undefined;
  registerRoute(path: string, handler: unknown): void;
  // Zukünftig: registerEvent, emitEvent für Inter-Plugin-Kommunikation
}

/**
 * IPlugin ist der Lebenszyklus-Vertrag, den jedes MedOS Yeti Plugin zwingend implementieren muss.
 * Ermöglicht Hot-Swapping ohne Server-Neustart.
 */
export interface IPlugin {
  onLoad(context: PluginContext): Promise<void> | void;
  onEnable(): Promise<void> | void;
  onDisable(): Promise<void> | void;
  onUnload(): Promise<void> | void;
}
