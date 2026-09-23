/**
 * DatabaseService: Lazy Singleton für den PrismaClient.
 * 
 * Das Laden des PrismaClient wird komplett lazy via dynamic import durchgeführt,
 * damit der Kernel auch auf Systemen startet, wo Prisma nicht funktioniert
 * (z.B. ARM64 Windows — kein natives Query Engine Binary verfügbar).
 * Auf dem Linux-Produktionsserver funktioniert alles fehlerfrei.
 */
export class DatabaseService {
  private static instance: any = null;
  private static initFailed = false;

  /**
   * Gibt den PrismaClient zurück, oder null wenn Prisma nicht verfügbar ist.
   * Beim ersten Aufruf wird der Client lazy geladen.
   */
  public static async getClient(): Promise<any> {
    if (this.initFailed) return null;
    if (this.instance) return this.instance;

    try {
      const { PrismaClient } = await import('../generated/prisma/client.ts');
      this.instance = new PrismaClient();
      // Test-Connect um sofortige Fehler abzufangen
      await this.instance.$connect();
      console.log('[DatabaseService] PrismaClient erfolgreich verbunden.');
      return this.instance;
    } catch (err: any) {
      console.warn(`[DatabaseService] PrismaClient nicht verfügbar: ${err.message}`);
      console.warn('[DatabaseService] DB-Features deaktiviert. Auf Linux-Produktionsserver funktioniert Prisma.');
      this.initFailed = true;
      this.instance = null;
      return null;
    }
  }
}
