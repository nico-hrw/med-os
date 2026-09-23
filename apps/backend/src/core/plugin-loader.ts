import * as fs from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';
import chokidar from 'chokidar';
import { IPlugin, ManifestSchema, PluginContext } from '../interfaces/core-interfaces';
import { broadcastEvent, registerApiRoute } from './event-stream';
import { PluginDBProxy } from './plugin-db-proxy';

/**
 * KernelContext: Schlanke, interne Implementierung des PluginContext.
 * Verwendet eine Map zur Service-Registrierung und -Auflösung.
 * Wird pro Plugin eingefroren, damit Plugins den Kern nicht manipulieren.
 */
class KernelContext implements PluginContext {
  private services = new Map<string, unknown>();

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

  /**
   * Erzeugt eine eingefrorene Kopie dieses Contexts für ein spezifisches Plugin.
   * Der DB-Service wird durch einen scoped PluginDBProxy ersetzt.
   */
  createSandboxedContext(pluginName: string): PluginContext {
    const prisma = this.services.get('db') as any;
    const proxy = prisma ? new PluginDBProxy(prisma, pluginName) : undefined;

    const sandboxed: PluginContext = {
      registerService: (name: string, service: unknown) => {
        this.registerService(name, service);
      },
      getService: <T>(name: string): T | undefined => {
        if (name === 'db') return proxy as T;
        return this.getService<T>(name);
      },
      registerRoute: (routePath: string, handler: unknown) => {
        this.registerRoute(routePath, handler);
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
 * Löst Plugins via Hot-Swapping zur Laufzeit auf.
 */
export class PluginLoader {
  private plugins = new Map<string, LoadedPlugin>();
  private context = new KernelContext();
  private watcher?: chokidar.FSWatcher;
  private pluginsAvailableDir: string;

  constructor(private pluginsDir: string) {
    // plugins-available/ liegt auf gleicher Ebene wie plugins/
    this.pluginsAvailableDir = path.resolve(pluginsDir, '../plugins-available');
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
      ignored: /(^|[\/\\])\\..|node_modules/,
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
        // Initiales Laden auslösen, sobald eine plugin.json gefunden wird
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
   * Führt optional onInstall() aus und meldet Fortschritt via SSE.
   */
  public async installPlugin(pluginId: string): Promise<void> {
    const sourcePath = path.join(this.pluginsAvailableDir, pluginId);
    const targetPath = path.join(this.pluginsDir, pluginId);

    try {
      // 0. Prüfen ob Vorlage existiert
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
      // Gut — Zielordner existiert noch nicht
    }

    try {
      // 1. Kopiere Vorlagen-Ordner → Live-Ordner
      broadcastEvent('PLUGIN_UPDATE', {
        action: 'INSTALL_PROGRESS',
        plugin: pluginId,
        message: 'Kopiere Plugin-Dateien...',
        percent: 5,
      });

      await fs.cp(sourcePath, targetPath, { recursive: true });

      // 2. Lade das Plugin temporär, um onInstall() auszuführen
      const manifestRaw = await fs.readFile(path.join(targetPath, 'plugin.json'), 'utf-8');
      const manifest = JSON.parse(manifestRaw) as ManifestSchema;
      const entryPath = path.join(targetPath, manifest.entry);
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

      // 3. Abschluss melden — der Watcher erkennt die neue plugin.json
      //    und lädt das Plugin dann automatisch über den regulären Lifecycle.
      broadcastEvent('PLUGIN_UPDATE', {
        action: 'INSTALL_COMPLETE',
        plugin: pluginId,
        message: 'Installation abgeschlossen!',
        percent: 100,
      });

    } catch (err: any) {
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

  // ─────────────────────────────────────────────────────────────
  //  Hot-Swap Internals
  // ─────────────────────────────────────────────────────────────

  private handleFileChange(filePath: string): void {
    // Extrahiere das Root-Verzeichnis des spezifischen Plugins
    const relativePath = path.relative(this.pluginsDir, filePath);
    const pluginDirName = relativePath.split(path.sep)[0];
    if (!pluginDirName) return;

    const pluginPath = path.join(this.pluginsDir, pluginDirName);
    
    // Trigger Hot-Reload (isoliert)
    this.reloadPlugin(pluginPath).catch(err => {
      console.error(`[PluginLoader] Kritischer Kernel-Fehler beim Hot-Swapping von ${pluginDirName}:`, err.message);
    });
  }

  private async reloadPlugin(pluginPath: string): Promise<void> {
    const manifestPath = path.join(pluginPath, 'plugin.json');
    
    let manifestRaw: string;
    try {
      manifestRaw = await fs.readFile(manifestPath, 'utf-8');
    } catch {
      // Ordner hat keine (oder nicht mehr) plugin.json -> kein valides Plugin
      return; 
    }

    // 1. Manifest validieren
    const manifest = JSON.parse(manifestRaw) as ManifestSchema;
    if (!manifest.name || !manifest.entry) {
      throw new Error(`Manifest in ${pluginPath} ist ungültig (Name oder Entry fehlen)`);
    }

    // 2. Hot-Unload: Falls bereits geladen, sauber deaktivieren
    if (this.plugins.has(manifest.name)) {
      console.log(`[PluginLoader] Hot-Reload initiiert: ${manifest.name}`);
      await this.unloadPlugin(manifest.name);
    }

    // 3. Cache-Busting: Dynamic Import zwingen, node.js Cache zu umgehen
    const entryPath = path.join(pluginPath, manifest.entry);
    const entryUrl = new URL(pathToFileURL(entryPath).href);
    entryUrl.searchParams.set('t', Date.now().toString()); // Timestamp als Cache-Buster

    try {
      const module = await import(entryUrl.href);
      const PluginClass = module.default;
      
      if (!PluginClass) {
        throw new Error('Das Plugin exportiert keinen default-Constructor (Klasse).');
      }

      // 4. Instanziierung & Contract-Validation (IPlugin)
      const instance = new PluginClass() as IPlugin;
      if (typeof instance.onLoad !== 'function' || typeof instance.onEnable !== 'function') {
        throw new Error('Klasse implementiert das IPlugin-Interface nicht vollständig.');
      }

      // 5. Lifecycle ausführen — mit gesandboxtem Context
      const sandboxedCtx = this.context.createSandboxedContext(manifest.name);
      await instance.onLoad(sandboxedCtx);
      await instance.onEnable();

      // 6. In der internen Registry speichern
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
      // Zwingend den Graceful-Shutdown des Plugins einleiten
      if (typeof plugin.instance.onDisable === 'function') {
        await plugin.instance.onDisable();
      }
      if (typeof plugin.instance.onUnload === 'function') {
        await plugin.instance.onUnload();
      }
    } catch (err: any) {
      // Fehler beim Shutdown fangen, damit das System sauber weiterläuft
      console.error(`[Kernel Guard] Fehler beim Entladen von ${name}:`, err.message);
    } finally {
      // Das Modul wird rigoros aus der Registry entfernt
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
