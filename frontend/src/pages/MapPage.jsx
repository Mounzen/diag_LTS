import React from 'react';
import { MapPinned } from 'lucide-react';
import { EmptyState } from '../components/ui';

export default function MapPage() {
  return (
    <div className="panel">
      <EmptyState icon={MapPinned} title="Cartographie préparée" text="Les coordonnées logements seront branchées dans une phase dédiée." />
    </div>
  );
}
