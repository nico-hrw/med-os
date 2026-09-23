import * as fs from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';
import chokidar from 'chokidar';
import { IPlugin, ManifestSchema, PluginContext } from '../interfaces/core-interfaces';
import { broadcastEvent } from './event-stream';

/**
 * KernelContext: Schlanke, interne Implementierung des PluginContext.
 * Verwendet eine Map zur Service-Registrierung und -Auflösung.
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
    const { registerApiRoute } = require('./event-stream');
    registerApiRoute(routePath, handler as Function);
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

  constructor(private pluginsDir: string) {}

  /**
   * Registriert einen globalen Service im Kernel-Kontext.
   */
  public registerService(name: string, service: unknown): void {
    this.context.registerService(name, service);
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
      .on('change', (filePath) => this.handleFileChange(filePath))
      .on('add', (filePath) => {
        // Initiales Laden auslösen, sobald eine plugin.json gefunden wird
        if (path.basename(filePath) === 'plugin.json') {
          this.handleFileChange(filePath);
        }
      })
      .on('unlinkDir', (dirPath) => this.handlePluginRemove(dirPath));
  }

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

      // 5. Lifecycle ausführen
      await instance.onLoad(this.context);
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
