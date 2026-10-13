/**
 * @file plugin-db-proxy.ts
 * @description Sicherheitsproxy für den PrismaClient.
 * 
 * Plugins erhalten keinen direkten Zugriff auf den PrismaClient, sondern
 * diesen eingeschränkten Proxy. Er erzwingt:
 *   1. Scoping: Jedes Plugin kann nur seine eigenen Daten lesen/schreiben.
 *   2. Blockierung: Raw-SQL, $disconnect, $connect etc. sind gesperrt.
 *
 * Der PrismaClient wird als 'any' injiziert, um statische Imports der
 * generierten Prisma-Dateien zu vermeiden (verhindert DLL-Ladung bei Import-Zeit).
 */

export class PluginDBProxy {
  constructor(
    private prisma: any,
    private pluginName: string
  ) {}

  /** Erstellt einen neuen Datensatz — pluginName wird automatisch gesetzt. */
  async create(data: { key: string; payload: string }) {
    return this.prisma.pluginData.create({
      data: {
        pluginName: this.pluginName,
        key: data.key,
        payload: data.payload,
      },
    });
  }

  /** Gibt alle Datensätze dieses Plugins zurück. */
  async findMany(options?: { orderBy?: Record<string, 'asc' | 'desc'> }) {
    return this.prisma.pluginData.findMany({
      where: { pluginName: this.pluginName },
      orderBy: options?.orderBy,
    });
  }

  /** Findet einen einzelnen Datensatz über die ID — nur wenn er diesem Plugin gehört. */
  async findUnique(id: string) {
    const record = await this.prisma.pluginData.findUnique({ where: { id } });
    if (record && record.pluginName !== this.pluginName) {
      throw new Error(`[PluginDBProxy] Zugriff verweigert: Datensatz gehört nicht zu '${this.pluginName}'.`);
    }
    return record;
  }

  /** Findet einen Datensatz über den eindeutigen Key dieses Plugins. */
  async findByKey(key: string) {
    return this.prisma.pluginData.findUnique({
      where: {
        pluginName_key: {
          pluginName: this.pluginName,
          key,
        },
      },
    });
  }

  /** Aktualisiert einen Datensatz — nur wenn er diesem Plugin gehört. */
  async update(id: string, data: { key?: string; payload?: string }) {
    const record = await this.prisma.pluginData.findUnique({ where: { id } });
    if (!record || record.pluginName !== this.pluginName) {
      throw new Error(`[PluginDBProxy] Zugriff verweigert: Datensatz gehört nicht zu '${this.pluginName}'.`);
    }
    return this.prisma.pluginData.update({
      where: { id },
      data,
    });
  }

  /**
   * Speichert oder aktualisiert einen Datensatz anhand seines Keys (Upsert).
   * Verhindert Unique-Constraint-Konflikte (P2002).
   */
  async upsert(key: string, payload: string) {
    return this.prisma.pluginData.upsert({
      where: {
        pluginName_key: {
          pluginName: this.pluginName,
          key,
        },
      },
      update: { payload },
      create: {
        pluginName: this.pluginName,
        key,
        payload,
      },
    });
  }

  /** Löscht einen einzelnen Datensatz — nur wenn er diesem Plugin gehört. */
  async delete(id: string) {
    const record = await this.prisma.pluginData.findUnique({ where: { id } });
    if (!record || record.pluginName !== this.pluginName) {
      throw new Error(`[PluginDBProxy] Zugriff verweigert: Datensatz gehört nicht zu '${this.pluginName}'.`);
    }
    return this.prisma.pluginData.delete({ where: { id } });
  }

  /** Löscht einen Datensatz anhand seines Keys. */
  async deleteByKey(key: string) {
    return this.prisma.pluginData.deleteMany({
      where: {
        pluginName: this.pluginName,
        key,
      },
    });
  }

  /** Liest und parst ein JSON-Objekt aus dem Payload eines Keys. */
  async getJson<T = any>(key: string): Promise<T | null> {
    const record = await this.findByKey(key);
    if (!record?.payload) return null;
    try {
      return JSON.parse(record.payload) as T;
    } catch {
      return null;
    }
  }

  /** Serialisiert und speichert ein beliebiges Objekt als JSON unter dem angegebenen Key. */
  async setJson(key: string, data: any): Promise<any> {
    const payload = JSON.stringify(data);
    return this.upsert(key, payload);
  }

  /** Zählt die Datensätze dieses Plugins. */
  async count() {
    return this.prisma.pluginData.count({
      where: { pluginName: this.pluginName },
    });
  }
}
