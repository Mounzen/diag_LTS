import { preconisationsForDiagnostic, strategicPreconisations } from '../../config/preconisations.js';

// Phase 14 preparation: deterministic rédaction is used now. This service is
// the integration point for a later AI provider without coupling reports to it.
export function redigerPreconisationsDiagnostic(diagnostic) {
  return preconisationsForDiagnostic(diagnostic);
}

export function redigerPreconisationsStrategiques(summary) {
  return strategicPreconisations(summary);
}
