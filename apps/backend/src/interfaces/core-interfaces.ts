/**
 * @file core-interfaces.ts
 * @description Grundlegende Typisierungen für die MedOS Yeti Plugin-Architektur.
 */

/**
 * ManifestSchema definiert die Struktur der `plugin.json`.
 * Beschreibt Metadaten und Abhängigkeiten des Plugins.
 */
export interface DependencyRef {
  id: string;
  name: string;
}

export interface RouteRef {
  name: string;
  path: string;
}

export interface ManifestSchema {
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;       // Emoji als visueller Indikator im Plugin-Store
  category?: string;   // z.B. "Patientenmanagement", "Diagnostik"
  dependencies?: DependencyRef[];
  routes?: RouteRef[];
  entry: string;
}

/**
 * PluginContext wird jedem Plugin zur Laufzeit injiziert.
 * Gewährt kontrollierten Zugriff auf die Kern-APIs des Microkernels.
 */
export interface PluginContext {
  /** Registriert einen Service für andere Plugins oder Kernel-Komponenten */
  registerService(name: string, service: unknown): void;
  /** Bezieht einen registrierten Service (z.B. 'db') */
  getService<T>(name: string): T | undefined;
  /** Registriert eine HTTP-API-Route (z.B. 'GET /api/my-plugin/data') */
  registerRoute(path: string, handler: unknown): void;
  /** Sendet ein SSE-Broadcast-Event an verbundene Frontend-Clients */
  broadcast(eventType: string, payload: any): void;
  /** Sendet ein internes Event im Kernel/Plugin-Bus */
  emitEvent(eventType: string, payload: any): void;
  /** Abonniert ein internes Event im Bus (wird beim Unload automatisch deregistriert) */
  onEvent(eventType: string, handler: (payload: any) => void): () => void;
}

/**
 * Callback-Signatur für Fortschrittsberichte während der Plugin-Installation.
 */
export type InstallProgressCallback = (message: string, percent: number) => void;

/**
 * IPlugin ist der Lebenszyklus-Vertrag, den jedes MedOS Yeti Plugin zwingend implementieren muss.
 * Ermöglicht Hot-Swapping ohne Server-Neustart.
 */
export interface IPlugin {
  onLoad(context: PluginContext): Promise<void> | void;
  onEnable(): Promise<void> | void;
  onDisable(): Promise<void> | void;
  onUnload(): Promise<void> | void;

  /**
   * Optionale Installationsroutine. Wird einmalig beim ersten Deployment
   * aus dem Plugin-Store aufgerufen. Plugins können hier DB-Migrationen,
   * Seed-Daten oder Konfigurationen anlegen.
   */
  onInstall?(reportProgress: InstallProgressCallback): Promise<void>;

  /**
   * Optionale Deinstallationsroutine. Wird aufgerufen, bevor das Plugin
   * vom System entfernt wird.
   * @param keepData Wenn true, bleiben gespeicherte Daten/Tabellen erhalten (Soft Uninstall).
   */
  onUninstall?(keepData: boolean): Promise<void>;
}

