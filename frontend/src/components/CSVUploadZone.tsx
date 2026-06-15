import { useState } from 'react';
import MappingWizardModal from './MappingWizardModal';

export default function CSVUploadZone() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">Import Bookings (CSV)</h2>
        <p className="text-xs text-slate-400">Upload a partner extract and map its columns to add or update bookings in bulk.</p>
      </div>
      <button
        type="button"
        onClick={() => setIsWizardOpen(true)}
        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        Import Bookings
      </button>

      <MappingWizardModal isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
    </div>
  );
}
