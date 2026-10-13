import {
  DemandProfile,
  HourlyArrivalRate,
  PatientDemand,
  RoomType,
  Specialty,
  TriageCategory,
} from '../types/simulation-types';
import { SeasonalCurveModel } from './seasonal-curves';

export interface PredictorOptions {
  baseDailyVolume?: number;
  enableOverbookingAdjustment?: boolean;
}

export class DemandPredictor {
  private baseDailyVolume: number;
  private enableOverbooking: boolean;

  constructor(options?: PredictorOptions) {
    this.baseDailyVolume = options?.baseDailyVolume ?? 60;
    this.enableOverbooking = options?.enableOverbookingAdjustment ?? true;
  }

  public predictDemandForDate(dateStr: string): DemandProfile {
    const targetDate = new Date(dateStr);
    const factors = SeasonalCurveModel.getSeasonalFactors(targetDate);

    const adjustedTotal = Math.round(
      this.baseDailyVolume * factors.monthFactor * factors.weekdayFactor
    );

    const hourlyRates: HourlyArrivalRate[] = [];
    const patients: PatientDemand[] = [];

    let totalWeight = 0;
    for (let h = 8; h < 18; h++) {
      totalWeight += SeasonalCurveModel.getHourlyDistribution(h);
    }

    let patientIndex = 1;

    for (let h = 8; h < 18; h++) {
      const distWeight = SeasonalCurveModel.getHourlyDistribution(h);
      const expectedInHour = Math.max(1, Math.round((distWeight / totalWeight) * adjustedTotal));

      hourlyRates.push({
        hour: h,
        expectedArrivals: expectedInHour,
        peakFactor: parseFloat((distWeight / (totalWeight / 10)).toFixed(2)),
      });

      for (let i = 0; i < expectedInHour; i++) {
        const arrivalMinuteInHour = Math.floor(Math.random() * 59);
        const arrivalTimeMins = (h - 8) * 60 + arrivalMinuteInHour;

        const triage = this.sampleTriageCategory();
        const specialty = this.sampleSpecialty();
        const room = this.sampleRoom(triage, specialty);
        const duration = this.calculateBaseDuration(triage);
        const noShow = this.sampleNoShow(triage, factors.baseNoShowRate);

        patients.push({
          id: `PAT-${targetDate.toISOString().slice(0, 10)}-${String(patientIndex++).padStart(3, '0')}`,
          arrivalTimeMins,
          triage,
          urgencyLevel: triage === 'notfall' ? 0 : triage === 'routine' ? 2 : 3,
          requiredSpecialty: specialty,
          requiredRoom: room,
          baseDurationMins: duration,
          isNoShow: noShow,
        });
      }
    }

    patients.sort((a, b) => a.arrivalTimeMins - b.arrivalTimeMins);

    return {
      date: dateStr,
      totalExpectedPatients: patients.length,
      noShowProbability: parseFloat(factors.baseNoShowRate.toFixed(2)),
      hourlyArrivalRates: hourlyRates,
      generatedPatients: patients,
    };
  }

  private sampleTriageCategory(): TriageCategory {
    const rand = Math.random();
    if (rand < 0.15) return 'notfall';
    if (rand < 0.80) return 'routine';
    return 'schnellspur';
  }

  private sampleSpecialty(): Specialty {
    const rand = Math.random();
    if (rand < 0.55) return 'Allgemeinmedizin';
    if (rand < 0.75) return 'Innere Medizin';
    if (rand < 0.90) return 'Orthopaedie';
    return 'Chirurgie';
  }

  private sampleRoom(triage: TriageCategory, specialty: Specialty): RoomType {
    if (specialty === 'Chirurgie') return 'surgery';
    if (specialty === 'Orthopaedie' && Math.random() < 0.4) return 'xray';
    if (triage === 'notfall' && Math.random() < 0.25) return 'isolation';
    return 'standard';
  }

  private calculateBaseDuration(triage: TriageCategory): number {
    switch (triage) {
      case 'notfall':
        return Math.floor(25 + Math.random() * 20);
      case 'routine':
        return Math.floor(10 + Math.random() * 12);
      case 'schnellspur':
        return Math.floor(3 + Math.random() * 5);
    }
  }

  private sampleNoShow(triage: TriageCategory, baseRate: number): boolean {
    if (triage === 'notfall') return false;
    const effectiveRate = triage === 'schnellspur' ? baseRate * 0.5 : baseRate;
    return Math.random() < effectiveRate;
  }
}
