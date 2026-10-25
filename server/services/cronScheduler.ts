import { runAutomatedServerCampaign, runAutomatedAirportCampaign } from './campaignEngine.js';

interface CronExecutionLog {
  lastPricingRunHour: string | null;
  lastAirportRunHour: string | null;
}

const state: CronExecutionLog = {
  lastPricingRunHour: null,
  lastAirportRunHour: null
};

const PRICING_HOURS = [8, 13, 18];
const AIRPORT_HOURS = [20, 23, 2];

let timer: NodeJS.Timeout | null = null;

export function startCronScheduler() {
  if (timer) return;

  console.log('[Cron Scheduler] Initialisation du planificateur automatique des tarifs:');
  console.log('  -> Pricing Général: 08:00, 13:00, 18:00 UTC');
  console.log('  -> Destinations Aéroport: 20:00, 23:00, 02:00 UTC');

  // Vérification toutes les 30 secondes
  timer = setInterval(async () => {
    try {
      const now = new Date();
      const currentUtcHour = now.getUTCHours();
      const currentUtcMinute = now.getUTCMinutes();
      const dateKey = now.toISOString().split('T')[0];

      // 1. Cron Pricing Général : 8h, 13h, 18h (déclenché à la minute 0..3 de l'heure)
      if (PRICING_HOURS.includes(currentUtcHour) && currentUtcMinute <= 3) {
        const slotKey = `${dateKey}-${currentUtcHour}`;
        if (state.lastPricingRunHour !== slotKey) {
          state.lastPricingRunHour = slotKey;
          console.log(`[Cron Scheduler] Déclenchement automatique Pricing Général pour le créneau ${currentUtcHour}:00 UTC...`);
          try {
            await runAutomatedServerCampaign(undefined, `Planificateur Automatique (${currentUtcHour}h UTC)`);
          } catch (err: any) {
            console.error('[Cron Scheduler Error - Pricing]:', err.message);
          }
        }
      }

      // 2. Cron Destinations Aéroport : 20h, 23h, 2h (déclenché à la minute 0..3 de l'heure)
      if (AIRPORT_HOURS.includes(currentUtcHour) && currentUtcMinute <= 3) {
        const slotKey = `${dateKey}-${currentUtcHour}`;
        if (state.lastAirportRunHour !== slotKey) {
          state.lastAirportRunHour = slotKey;
          console.log(`[Cron Scheduler] Déclenchement automatique Destinations Aéroport pour le créneau ${currentUtcHour}:00 UTC...`);
          try {
            await runAutomatedAirportCampaign(undefined, `Planificateur Automatique Aéroport (${currentUtcHour}h UTC)`);
          } catch (err: any) {
            console.error('[Cron Scheduler Error - Airport]:', err.message);
          }
        }
      }
    } catch (schedErr: any) {
      console.warn('[Cron Scheduler Loop Warning]:', schedErr.message);
    }
  }, 30000);
}

export function stopCronScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
