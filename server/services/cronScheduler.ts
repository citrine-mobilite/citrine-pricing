/**
 * Planificateur automatique des campagnes de tarification
 * DÉSACTIVÉ à la demande de l'administrateur pour la production.
 * Aucun minuteur ne s'exécute en arrière-plan.
 */

let timer: NodeJS.Timeout | null = null;

export function startCronScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  console.log('[Cron Scheduler] Tous les cron jobs automatiques sont DÉSACTIVÉS conformément à la configuration.');
}

export function stopCronScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  console.log('[Cron Scheduler] Planificateur arrêté.');
}
