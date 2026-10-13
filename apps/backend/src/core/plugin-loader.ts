import * as fs from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { EventEmitter } from 'events';
import chokidar from 'chokidar';
import { IPlugin, ManifestSchema, PluginContext } from '../interfaces/core-interfaces';
import { broadcastEvent, registerApiRoute, unregisterApiRoute } from './event-stream';
import { PluginDBProxy } from './plugin-db-proxy';

const RESERVED_SERVICES = new Set(['db', 'kernel', 'events']);

/**
 * KernelContext: Interne Implementierung des PluginContext.
 * Verwaltet Services, Routen und Event-Subscriptions mit strikter Isolierung und Namespace-Schutz.
 */
class KernelContext implements PluginContext {
  private services = new Map<string, unknown>();
  private pluginRoutes = new Map<string, Set<string>>();
  private pluginServices = new Map<string, Set<string>>();
  private kernelEventBus = new EventEmitter();
  private pluginEventListeners = new Map<string, Array<{ event: string; listener: (...args: any[]) => void }>>();

  registerService(name: string, service: unknown): void {
    if (this.services.has(name)) {
      console.warn(`[Kernel] Warnung: Service '${name}' wird überschrieben.`);
    }
    this.services.set(name, service);
  }

  getService<T>(name: string): T | undefined {
    return this.services.get(name) as T | undefined;
  }

  registerRoute(routePath: string, handler: unknown): void {
    console.log(`[Kernel] Route registriert: ${routePath}`);
    registerApiRoute(routePath, handler as Function);
  }

  broadcast(eventType: string, payload: any): void {
    broadcastEvent(eventType, payload);
  }

  emitEvent(eventType: string, payload: any): void {
    this.kernelEventBus.emit(eventType, payload);
  }

  onEvent(eventType: string, handler: (payload: any) => void): () => void {
    this.kernelEventBus.on(eventType, handler);
    return () => {
      this.kernelEventBus.off(eventType, handler);
    };
  }

  /**
   * Bereinigt alle Ressourcen (Routen, Services, Event-Listener), die ein Plugin registriert hat.
   */
  unregisterPlugin(pluginName: string): void {
    // 1. Routen deregistrieren
    const routes = this.pluginRoutes.get(pluginName);
    if (routes) {
      for (const routePath of routes) {
        console.log(`[Kernel] Route deregistriert für '${pluginName}': ${routePath}`);
        unregisterApiRoute(routePath);
      }
      this.pluginRoutes.delete(pluginName);
    }

    // 2. Services entfernen
    const services = this.pluginServices.get(pluginName);
    if (services) {
      for (const serviceName of services) {
        console.log(`[Kernel] Service deregistriert für '${pluginName}': ${serviceName}`);
        this.services.delete(serviceName);
      }
      this.pluginServices.delete(pluginName);
    }

    // 3. Event-Listener abmelden
    const listeners = this.pluginEventListeners.get(pluginName);
    if (listeners) {
      for (const { event, listener } of listeners) {
        this.kernelEventBus.off(event, listener);
      }
      this.pluginEventListeners.delete(pluginName);
    }
  }

  /**
   * Erzeugt eine isolierte Sandbox-Kopie dieses Contexts für ein spezifisches Plugin.
   * - Der DB-Service wird durch einen scoped PluginDBProxy ersetzt.
   * - System-Routen (/api/system/*, /api/events) sind vor Überschreibung geschützt.
   * - Reservierte Kern-Services (db, kernel, events) können nicht von Plugins überschrieben werden.
   * - Alle Ressourcen werden getrackt und beim Unload automatisch restlos bereinigt.
   */
  createSandboxedContext(pluginName: string): PluginContext {
    const prisma = this.services.get('db') as any;
    const proxy = prisma ? new PluginDBProxy(prisma, pluginName) : undefined;

    if (!this.pluginRoutes.has(pluginName)) {
      this.pluginRoutes.set(pluginName, new Set());
    }
    if (!this.pluginServices.has(pluginName)) {
      this.pluginServices.set(pluginName, new Set());
    }
    if (!this.pluginEventListeners.has(pluginName)) {
      this.pluginEventListeners.set(pluginName, []);
    }

    const sandboxed: PluginContext = {
      registerService: (name: string, service: unknown) => {
        if (RESERVED_SERVICES.has(name.toLowerCase())) {
          throw new Error(`[Kernel Guard] Registrierung des reservierten Service-Namens '${name}' verweigert (Plugin: ${pluginName}).`);
        }
        this.pluginServices.get(pluginName)?.add(name);
        this.registerService(name, service);
      },
      getService: <T>(name: string): T | undefined => {
        if (name === 'db') return proxy as T;
        return this.getService<T>(name);
      },
      registerRoute: (routePath: string, handler: unknown) => {
        const parts = routePath.trim().split(/\s+/);
        const pathPart = parts.length > 1 ? parts[1] : parts[0];

        // Sicherheitsprüfung: Keine Überschreibung von System-Endpunkten erlauben
        if (pathPart.startsWith('/api/system/') || pathPart === '/api/events') {
          throw new Error(`[Kernel Guard] Sicherheitsverletzung: Plugin '${pluginName}' darf keine geschützten System-Routen ('${routePath}') registrieren.`);
        }

        this.pluginRoutes.get(pluginName)?.add(routePath);
        this.registerRoute(routePath, handler);
      },
      broadcast: (eventType: string, payload: any) => {
        this.broadcast(eventType, payload);
      },
      emitEvent: (eventType: string, payload: any) => {
        this.emitEvent(eventType, payload);
      },
      onEvent: (eventType: string, handler: (payload: any) => void) => {
        const unsub = this.onEvent(eventType, handler);
        this.pluginEventListeners.get(pluginName)?.push({ event: eventType, listener: handler });
        return unsub;
      },
    };

    return Object.freeze(sandboxed);
  }
}

interface LoadedPlugin {
  manifest: ManifestSchema;
  instance: IPlugin;
  folderPath: string;
}

/**
 * Der Kern des dynamischen Microkernel-Systems.
 * Löst Plugins via Hot-Swapping zur Laufzeit auf und schützt vor Race-Conditions und Path-Traversal.
 */
export class PluginLoader {
  private plugins = new Map<string, LoadedPlugin>();
  private context = new KernelContext();
  private watcher?: chokidar.FSWatcher;
  private pluginsAvailableDir: string;

  // Race-Condition & Concurrency Locks
  private installingPlugins = new Set<string>();
  private reloadingPlugins = new Set<string>();
  private reloadDebounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(private pluginsDir: string) {
    // plugins-available/ liegt auf gleicher Ebene wie plugins/
    this.pluginsAvailableDir = path.resolve(pluginsDir, '../plugins-available');
  }

  /**
   * Prüft, ob eine Plugin-ID syntaktisch sicher ist (nur Alphanumerik, Bindestrich, Unterstrich).
   * Verhindert Path-Traversal-Angriffe (z.B. '../../').
   */
  private isValidPluginId(pluginId: string): boolean {
    return typeof pluginId === 'string' && /^[a-zA-Z0-9_-]+$/.test(pluginId);
  }

  /**
   * Stellt sicher, dass ein aufgelöster Pfad strikt innerhalb des Basis-Verzeichnisses verbleibt.
   */
  private isSafeSubpath(parentDir: string, targetPath: string): boolean {
    const resolvedParent = path.resolve(parentDir);
    const resolvedTarget = path.resolve(targetPath);
    return resolvedTarget.startsWith(resolvedParent + path.sep);
  }

  /**
   * Registriert einen globalen Service im Kernel-Kontext.
   */
  public registerService(name: string, service: unknown): void {
    this.context.registerService(name, service);
  }

  /**
   * Gibt die Map der aktuell geladenen Plugins zurück (readonly).
   */
  public getLoadedPlugins(): ReadonlyMap<string, LoadedPlugin> {
    return this.plugins;
  }

  /**
   * Startet den Watcher für das Hot-Swapping im definierten Plugin-Ordner.
   */
  public watch(): void {
    console.log(`[PluginLoader] Überwache: ${this.pluginsDir}`);
    
    // Ignoriere node_modules und versteckte Verzeichnisse
    this.watcher = chokidar.watch(this.pluginsDir, {
      ignored: /(^|[\/\\])\..|node_modules/,
      persistent: true,
      depth: 2, 
      ignoreInitial: false
    });

    this.watcher
      .on('error', (err) => {
        // Windows: EBUSY/EPERM bei Datei-Locking — ignorieren, da der Watcher automatisch weiterläuft
        console.warn(`[PluginLoader] Watcher-Fehler (ignoriert): ${(err as any).code || err.message}`);
      })
      .on('change', (filePath) => this.handleFileChange(filePath))
      .on('add', (filePath) => {
        if (path.basename(filePath) === 'plugin.json') {
          this.handleFileChange(filePath);
        }
      })
      .on('unlinkDir', (dirPath) => this.handlePluginRemove(dirPath));
  }

  // ─────────────────────────────────────────────────────────────
  //  Plugin-Store API
  // ─────────────────────────────────────────────────────────────

  /**
   * Liest alle verfügbaren Plugin-Vorlagen aus plugins-available/.
   */
  public async getAvailablePlugins(): Promise<(ManifestSchema & { installed: boolean })[]> {
    const results: (ManifestSchema & { installed: boolean })[] = [];

    try {
      const entries = await fs.readdir(this.pluginsAvailableDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const manifestPath = path.join(this.pluginsAvailableDir, entry.name, 'plugin.json');
        try {
          const raw = await fs.readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(raw) as ManifestSchema;
          results.push({
            ...manifest,
            installed: this.plugins.has(manifest.name),
          });
        } catch {
          // Ordner ohne gültige plugin.json — überspringen
        }
      }
    } catch {
      console.warn('[PluginLoader] plugins-available/ nicht gefunden oder nicht lesbar.');
    }

    return results;
  }

  /**
   * Installiert ein Plugin aus plugins-available/ nach plugins/.
   * Verhindert Race-Conditions mit dem File-Watcher und führt onInstall() sauber aus.
   */
  public async installPlugin(pluginId: string): Promise<void> {
    // 0. Sicherheits-Validierung der Plugin-ID
    if (!this.isValidPluginId(pluginId)) {
      broadcastEvent('PLUGIN_UPDATE', {
        action: 'INSTALL_ERROR',
        plugin: pluginId,
        error: `Ungültige Plugin-ID: '${pluginId}'. Nur alphanumerische Zeichen, '-' und '_' erlaubt.`,
      });
      return;
    }

    const sourcePath = path.join(this.pluginsAvailableDir, pluginId);
    const targetPath = path.join(this.pluginsDir, pluginId);

    if (!this.isSafeSubpath(this.pluginsAvailableDir, sourcePath) || !this.isSafeSubpath(this.pluginsDir, targetPath)) {
      broadcastEvent('PLUGIN_UPDATE', {
        action: 'INSTALL_ERROR',
        plugin: pluginId,
        error: `Sicherheitsfehler: Pfad-Traversal erkannt für Plugin '${pluginId}'.`,
      });
      return;
    }

    try {
      await fs.access(sourcePath);
    } catch {
      broadcastEvent('PLUGIN_UPDATE', {
        action: 'INSTALL_ERROR',
        plugin: pluginId,
        error: `Vorlage '${pluginId}' nicht in plugins-available/ gefunden.`,
      });
      return;
    }

    // Prüfen ob bereits installiert
    try {
      await fs.access(targetPath);
      broadcastEvent('PLUGIN_UPDATE', {
        action: 'INSTALL_ERROR',
        plugin: pluginId,
        error: `Plugin '${pluginId}' ist bereits installiert.`,
      });
      return;
    } catch {
      // Zielordner existiert noch nicht — bereit zur Installation
    }

    // Lock setzen: Watcher ignoriert Dateiänderungen während des Kopiervorgangs
    this.installingPlugins.add(pluginId);

    try {
      broadcastEvent('PLUGIN_UPDATE', {
        action: 'INSTALL_PROGRESS',
        plugin: pluginId,
        message: 'Kopiere Plugin-Dateien...',
        percent: 5,
      });

      await fs.cp(sourcePath, targetPath, { recursive: true });

      // Manifest lesen und validieren
      const manifestRaw = await fs.readFile(path.join(targetPath, 'plugin.json'), 'utf-8');
      const manifest = JSON.parse(manifestRaw) as ManifestSchema;

      if (!manifest.entry) {
        throw new Error('plugin.json enthält kein gültiges "entry"-Feld.');
      }

      const entryPath = path.resolve(targetPath, manifest.entry);
      if (!this.isSafeSubpath(targetPath, entryPath)) {
        throw new Error(`Sicherheitsfehler: Entry-Point '${manifest.entry}' verlässt das Plugin-Verzeichnis.`);
      }

      const entryUrl = new URL(pathToFileURL(entryPath).href);
      entryUrl.searchParams.set('t', Date.now().toString());

      const module = await import(entryUrl.href);
      const PluginClass = module.default;

      if (PluginClass) {
        const instance = new PluginClass() as IPlugin;

        if (typeof instance.onInstall === 'function') {
          const progressCallback = (message: string, percent: number) => {
            broadcastEvent('PLUGIN_UPDATE', {
              action: 'INSTALL_PROGRESS',
              plugin: pluginId,
              message,
              percent,
            });
          };

          await instance.onInstall(progressCallback);
        }
      }

      // Lock freigeben und Plugin kontrolliert aktivieren
      this.installingPlugins.delete(pluginId);
      await this.reloadPlugin(targetPath);

      broadcastEvent('PLUGIN_UPDATE', {
        action: 'INSTALL_COMPLETE',
        plugin: pluginId,
        message: 'Installation abgeschlossen!',
        percent: 100,
      });

    } catch (err: any) {
      this.installingPlugins.delete(pluginId);
      console.error(`[Kernel Guard] Fehler bei Installation von '${pluginId}':`, err.message);
      broadcastEvent('PLUGIN_UPDATE', {
        action: 'INSTALL_ERROR',
        plugin: pluginId,
        error: err.message,
      });

      // Cleanup: Teilweise kopierten Ordner entfernen
      try {
        await fs.rm(targetPath, { recursive: true, force: true });
      } catch { /* best effort */ }
    }
  }

  /**
   * Deinstalliert ein Plugin aus dem Live-Ordner plugins/.
   * Führt onUninstall(keepData) aus und löscht den Ordner nach Validierung.
   */
  public async uninstallPlugin(pluginId: string, keepData = true): Promise<void> {
    if (!this.isValidPluginId(pluginId)) {
      throw new Error(`Ungültige Plugin-ID: '${pluginId}'.`);
    }

    const targetPath = path.join(this.pluginsDir, pluginId);
    if (!this.isSafeSubpath(this.pluginsDir, targetPath)) {
      throw new Error(`Sicherheitsverletzung: Pfad-Traversal erkannt für '${pluginId}'.`);
    }

    try {
      // 1. Prüfen, ob das Plugin aktuell geladen ist
      const loaded = this.plugins.get(pluginId);
      if (loaded && typeof loaded.instance.onUninstall === 'function') {
        try {
          console.log(`[PluginLoader] Rufe onUninstall(keepData=${keepData}) für '${pluginId}' auf...`);
          await loaded.instance.onUninstall(keepData);
        } catch (hookErr: any) {
          console.warn(`[PluginLoader] Warnung: onUninstall() Fehler in '${pluginId}':`, hookErr.message);
        }
      }

      // 2. Falls keepData === false: Datenbereinigung
      if (!keepData) {
        const prisma = this.context.getService('db') as any;
        if (prisma?.pluginData) {
          try {
            await prisma.pluginData.deleteMany({ where: { pluginName: pluginId } });
            console.log(`[PluginLoader] DB-Daten für Plugin '${pluginId}' bereinigt.`);
          } catch (dbErr: any) {
            console.warn(`[PluginLoader] Konnte DB-Daten für '${pluginId}' nicht bereinigen:`, dbErr.message);
          }
        }
      }

      // 3. Hot-Unload ausführen (bereinigt Routen, Services und Event-Listener)
      await this.unloadPlugin(pluginId);

      // 4. Plugin-Verzeichnis löschen
      await fs.rm(targetPath, { recursive: true, force: true });
      console.log(`[PluginLoader] Plugin '${pluginId}' erfolgreich deinstalliert.`);

      // 5. SSE-Event über Deinstallation
      broadcastEvent('PLUGIN_UPDATE', {
        action: 'UNINSTALL_COMPLETE',
        plugin: pluginId,
        keepData,
        activeCount: this.plugins.size,
      });

    } catch (err: any) {
      console.error(`[PluginLoader] Fehler beim Deinstallieren von '${pluginId}':`, err.message);
      broadcastEvent('PLUGIN_UPDATE', {
        action: 'UNINSTALL_ERROR',
        plugin: pluginId,
        error: err.message,
      });
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Hot-Swap Internals mit Debouncing & Concurrency-Schutz
  // ─────────────────────────────────────────────────────────────

  private handleFileChange(filePath: string): void {
    const relativePath = path.relative(this.pluginsDir, filePath);
    const pluginDirName = relativePath.split(path.sep)[0];
    if (!pluginDirName) return;

    // Während einer laufenden Installation nicht reagieren (wird nach onInstall explizit geladen)
    if (this.installingPlugins.has(pluginDirName)) {
      return;
    }

    const pluginPath = path.join(this.pluginsDir, pluginDirName);

    // Debounce: Verhindert Mehrfachausführungen bei schnellen Schreiboperationen (z.B. Git, Build-Tools)
    const existingTimer = this.reloadDebounceTimers.get(pluginDirName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.reloadDebounceTimers.delete(pluginDirName);
      
      // Concurrency Lock: Verhindert parallele Reloads desselben Plugins
      if (this.reloadingPlugins.has(pluginDirName)) {
        return;
      }

      this.reloadingPlugins.add(pluginDirName);
      this.reloadPlugin(pluginPath)
        .catch(err => {
          console.error(`[PluginLoader] Kritischer Kernel-Fehler beim Hot-Swapping von ${pluginDirName}:`, err.message);
        })
        .finally(() => {
          this.reloadingPlugins.delete(pluginDirName);
        });
    }, 250);

    this.reloadDebounceTimers.set(pluginDirName, timer);
  }

  private async reloadPlugin(pluginPath: string): Promise<void> {
    const manifestPath = path.join(pluginPath, 'plugin.json');
    
    let manifestRaw: string;
    try {
      manifestRaw = await fs.readFile(manifestPath, 'utf-8');
    } catch {
      // Ordner hat keine plugin.json -> kein valides Plugin
      return; 
    }

    // 1. Manifest validieren
    let manifest: ManifestSchema;
    try {
      manifest = JSON.parse(manifestRaw) as ManifestSchema;
    } catch (parseErr: any) {
      throw new Error(`Ungültiges JSON in ${manifestPath}: ${parseErr.message}`);
    }

    if (!manifest.name || !manifest.entry) {
      throw new Error(`Manifest in ${pluginPath} ist ungültig (Name oder Entry fehlen).`);
    }

    if (!this.isValidPluginId(manifest.name)) {
      throw new Error(`Manifest name '${manifest.name}' enthält ungültige Zeichen.`);
    }

    // 2. Entry-Point Sicherheitsprüfung
    const entryPath = path.resolve(pluginPath, manifest.entry);
    if (!this.isSafeSubpath(pluginPath, entryPath)) {
      throw new Error(`Sicherheitsfehler: Entry '${manifest.entry}' verlässt Plugin-Verzeichnis.`);
    }

    try {
      await fs.access(entryPath);
    } catch {
      throw new Error(`Entry-Datei '${manifest.entry}' in ${pluginPath} nicht gefunden.`);
    }

    // 3. Hot-Unload: Falls bereits geladen, sauber deaktivieren & alle Ressourcen freigeben
    if (this.plugins.has(manifest.name)) {
      console.log(`[PluginLoader] Hot-Reload initiiert: ${manifest.name}`);
      await this.unloadPlugin(manifest.name);
    }

    // 4. Cache-Busting: Dynamic Import zwingen, Node.js Cache zu umgehen
    const entryUrl = new URL(pathToFileURL(entryPath).href);
    entryUrl.searchParams.set('t', Date.now().toString());

    try {
      const module = await import(entryUrl.href);
      const PluginClass = module.default;
      
      if (!PluginClass) {
        throw new Error('Das Plugin exportiert keinen default-Constructor (Klasse).');
      }

      // 5. Instanziierung & Contract-Validation (IPlugin)
      const instance = new PluginClass() as IPlugin;
      if (typeof instance.onLoad !== 'function' || typeof instance.onEnable !== 'function') {
        throw new Error('Klasse implementiert das IPlugin-Interface nicht vollständig.');
      }

      // 6. Lifecycle ausführen — mit gesandboxtem Context
      const sandboxedCtx = this.context.createSandboxedContext(manifest.name);
      await instance.onLoad(sandboxedCtx);
      await instance.onEnable();

      // 7. In der internen Registry speichern
      this.plugins.set(manifest.name, { manifest, instance, folderPath: pluginPath });
      console.log(`[PluginLoader] Aktiviert: ${manifest.name} v${manifest.version}`);
      
      // Benachrichtige das Dashboard über SSE
      broadcastEvent('PLUGIN_UPDATE', { 
        action: 'LOAD', 
        plugin: manifest.name, 
        activeCount: this.plugins.size 
      });
      
    } catch (err: any) {
      // Isoliere Prozess: Ein Plugin-Fehler (Syntax, Exception) darf den Kernel niemals crashen!
      console.error(`[Kernel Guard] Fehler im Plugin '${manifest.name}' abgefangen:`, err.message);
      
      broadcastEvent('PLUGIN_UPDATE', {
        action: 'PLUGIN_ERROR',
        plugin: manifest.name,
        error: err.message
      });
    }
  }

  private async handlePluginRemove(dirPath: string): Promise<void> {
    for (const [name, loaded] of this.plugins.entries()) {
      if (loaded.folderPath === dirPath) {
        console.log(`[PluginLoader] Plugin-Ordner entfernt. Initiiere Hot-Unload: ${name}`);
        await this.unloadPlugin(name);
        break;
      }
    }
  }

  private async unloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) return;

    try {
      // Graceful-Shutdown des Plugins einleiten
      if (typeof plugin.instance.onDisable === 'function') {
        await plugin.instance.onDisable();
      }
      if (typeof plugin.instance.onUnload === 'function') {
        await plugin.instance.onUnload();
      }
    } catch (err: any) {
      console.error(`[Kernel Guard] Fehler beim Entladen von ${name}:`, err.message);
    } finally {
      // Alle Routen, Services und Event-Subscriptions des Plugins rückstandslos bereinigen
      this.context.unregisterPlugin(name);

      // Aus interner Registry entfernen
      this.plugins.delete(name);
      console.log(`[PluginLoader] Erfolgreich entladen: ${name}`);

      // Benachrichtige das Dashboard über SSE
      broadcastEvent('PLUGIN_UPDATE', { 
        action: 'UNLOAD', 
        plugin: name, 
        activeCount: this.plugins.size 
      });
    }
  }
}
