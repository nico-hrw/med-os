import { IPlugin, PluginContext } from '../../apps/backend/src/interfaces/core-interfaces';

export default class PatientOnboardingPlugin implements IPlugin {
  private context?: PluginContext;

  async onLoad(context: PluginContext): Promise<void> {
    this.context = context;
    console.log('[Patienten-Onboarding] v1.0.0: onLoad() - Initialisiere Warteschlangen-DB...');
  }

  async onEnable(): Promise<void> {
    console.log('[Patienten-Onboarding] v1.0.0: onEnable() - Modul ist jetzt LIVE.');
    
    // Registriere einen simplen Dummy-Service im Kernel-Context
    const patientQueueService = {
      addPatient: (name: string) => console.log(`[Patienten-Onboarding] Neuer Patient aufgenommen: ${name}`),
      getQueueLength: () => 42
    };

    this.context?.registerService('PatientQueue', patientQueueService);
  }

  async onDisable(): Promise<void> {
    console.log('[Patienten-Onboarding] v1.0.0: onDisable() - Stoppe Datenströme und trenne Datenbank...');
  }

  async onUnload(): Promise<void> {
    console.log('[Patienten-Onboarding] v1.0.0: onUnload() - Ressourcen freigegeben. Tschüss!');
  }
}
