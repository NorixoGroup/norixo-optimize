// Traduction française des causes et actions du diagnostic. Le service serveur les
// produit en anglais (contrat inchangé) : l'interface les traduit ici, sans jamais
// afficher d'adresse, de port ni d'URL interne.

import type { DiagnosticStep } from "@/lib/youtube-agent/types";

const CAUSES: Array<[RegExp, string]> = [
  [/deployed on Vercel/i, "Norixo est déployé sur Vercel : le pont local n'est pas joignable depuis ce serveur."],
  [/Nothing is listening/i, "Aucun agent n'écoute : l'Usine IA Vidéo n'est pas démarrée sur cet ordinateur."],
  [/malformed/i, "L'adresse de l'agent configurée est mal formée."],
  [/not a local address/i, "L'adresse de l'agent configurée n'est pas une adresse locale : seules les adresses locales sont autorisées."],
  [/different bridge version/i, "L'agent utilise une autre version du pont que celle attendue par Norixo."],
  [/within 3 seconds/i, "L'agent n'a pas répondu dans le délai de 3 secondes."],
  [/little or no data/i, "L'agent est connecté, mais il contient encore peu ou pas de données (aucune donnée locale ou aucune production détectée)."],
  [/bridge is disabled/i, "L'agent est démarré, mais son pont est désactivé : il a été lancé sans jeton valide."],
  [/refused Norixo's token/i, "L'agent a refusé le jeton de Norixo : les deux valeurs sont différentes."],
  [/rejected the address/i, "L'agent a refusé l'adresse utilisée par Norixo pour le joindre."],
  [/unexpected error/i, "L'agent a renvoyé une erreur inattendue en lisant ses données."],
  [/token is not set/i, "Le jeton du pont n'est pas défini dans l'environnement de Norixo."],
  [/invalid format/i, "Le jeton du pont configuré a un format invalide."],
];

const ACTIONS: Array<[RegExp, string]> = [
  [/not stuck/i, "Vérifiez que l'agent n'est pas bloqué, puis redémarrez-le."],
  [/Nothing to fix/i, "Rien à corriger sur une installation neuve : les données apparaissent après la première production ou la première liaison vidéo."],
  [/console for the error/i, "Consultez la console de l'agent pour le détail de l'erreur, corrigez-la, puis relancez le diagnostic."],
  [/Run Norixo locally/i, "Lancez Norixo en local (mode développement) sur l'ordinateur qui exécute l'agent."],
  [/Update usine-ia-video/i, "Mettez à jour le projet usine-ia-video vers la version qui fournit le pont, puis redémarrez l'agent."],
  [/Start the agent/i, "Démarrez l'Usine IA Vidéo depuis le projet usine-ia-video, avec le jeton du pont défini, puis relancez le diagnostic."],
  [/Add .* to Norixo/i, "Ajoutez le jeton du pont dans la configuration locale de Norixo (même valeur que celle de l'agent), puis redémarrez Norixo."],
  [/identical/i, "Utilisez le même jeton dans la configuration de Norixo et au démarrage de l'agent, puis redémarrez les deux."],
  [/Restart the agent with/i, "Redémarrez l'agent en lui fournissant un jeton valide (32 caractères ou plus)."],
  [/Set .* to/i, "Corrigez l'adresse de l'agent dans la configuration de Norixo : indiquez une adresse locale complète, avec un port explicite."],
  [/Use 32 to 200/i, "Utilisez un jeton de 32 à 200 caractères (lettres, chiffres et les symboles . _ ~ -)."],
];

const FALLBACK_CAUSE = "Cause non identifiée.";
const FALLBACK_ACTION = "Relancez le diagnostic ; si le problème persiste, consultez la console de l'agent.";

export const OK_TEXT: Record<DiagnosticStep["id"], string> = {
  environment: "Norixo s'exécute en local.",
  configuration: "La configuration du pont est valide.",
  reachability: "L'agent répond.",
  bridge: "Le pont est activé côté agent.",
  authentication: "Le jeton est accepté par l'agent.",
  contract: "La version du pont est compatible.",
  data: "Les données de l'agent sont lisibles.",
};

function lookup(table: Array<[RegExp, string]>, source: string | undefined, fallback: string): string {
  if (!source) return fallback;

  return table.find(([re]) => re.test(source))?.[1] ?? fallback;
}

export function stepNarrative(step: DiagnosticStep | undefined): { cause: string | null; action: string | null; ok: string | null } {
  if (!step || step.status === "skipped") return { cause: null, action: null, ok: null };
  if (step.status === "ok") return { cause: null, action: null, ok: OK_TEXT[step.id] };

  return {
    cause: lookup(CAUSES, step.cause, FALLBACK_CAUSE),
    action: lookup(ACTIONS, step.action, FALLBACK_ACTION),
    ok: null,
  };
}
