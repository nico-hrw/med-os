export interface SeasonalFactors {
  monthFactor: number;
  weekdayFactor: number;
  baseNoShowRate: number;
}

export class SeasonalCurveModel {
  private static readonly MONTH_FACTORS: Record<number, number> = {
    0: 1.35,  // Januar (Grippewelle / Infektzeit)
    1: 1.30,  // Februar
    2: 1.15,  // Maerz
    3: 0.95,  // April
    4: 0.90,  // Mai
    5: 0.85,  // Juni (Sommerferien-Beginn)
    6: 0.80,  // Juli (Sommerferien)
    7: 0.85,  // August
    8: 1.05,  // September (Schulbeginn)
    9: 1.25,  // Oktober (Herbstwelle)
    10: 1.35, // November (Herbst/Winter)
    11: 1.20, // Dezember (Feiertagsreduktion, aber Infekte)
  };

  private static readonly WEEKDAY_FACTORS: Record<number, number> = {
    1: 1.25, // Montag (Morning Rush nach dem Wochenende)
    2: 1.05, // Dienstag
    3: 1.00, // Mittwoch (oft halber Praxistag)
    4: 1.05, // Donnerstag
    5: 0.90, // Freitag
    6: 0.40, // Samstag (nur Notdienst)
    0: 0.20, // Sonntag (nur Notdienst)
  };

  public static getHourlyDistribution(hour: number): number {
    // 08:00 - 18:00 diskretisiert
    switch (hour) {
      case 8: return 1.85; // Morning Rush Start
      case 9: return 1.70; // Peak Vormittag
      case 10: return 1.30;
      case 11: return 1.05;
      case 12: return 0.70; // Mittagspause
      case 13: return 0.80;
      case 14: return 1.15;
      case 15: return 1.35; // Nachmittags-Peak
      case 16: return 1.10;
      case 17: return 0.75;
      default: return 0.30;
    }
  }

  public static getSeasonalFactors(date: Date): SeasonalFactors {
    const month = date.getMonth();
    const weekday = date.getDay();

    const monthFactor = this.MONTH_FACTORS[month] ?? 1.0;
    const weekdayFactor = this.WEEKDAY_FACTORS[weekday] ?? 1.0;

    const baseNoShowRate = weekday === 1 ? 0.14 : 0.10;

    return {
      monthFactor,
      weekdayFactor,
      baseNoShowRate,
    };
  }
}
