import React from 'react';
import { CalendarClock } from 'lucide-react';
import { EmptyState } from '../components/ui';

export default function PlanningPage() {
  return (
    <div className="panel">
      <EmptyState icon={CalendarClock} title="Planification travaux préparée" text="Les interventions, entreprises et devis seront activés dans une phase dédiée." />
    </div>
  );
}
