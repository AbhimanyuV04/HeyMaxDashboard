import { useRef, useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { uploadBookingsCsv } from '../services/api';
import { PARTNERS } from '../types';
import { REQUIRED_FIELDS, autoMatchColumns, extractFileHeaders, isSupportedSpreadsheetFile } from '../utils/csvMapping';

interface MappingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Upload & Partner',
  2: 'Field Mapping',
  3: 'Confirm & Import',
};

export default function MappingWizardModal({ isOpen, onClose }: MappingWizardModalProps) {
  const { refreshData } = useBilling();
  const [step, setStep] = useState<Step>(1);
  const [partnerId, setPartnerId] = useState(PARTNERS[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  function resetState() {
    setStep(1);
    setPartnerId(PARTNERS[0]?.id ?? '');
    setFile(null);
    setColumns([]);
    setMapping({});
    setIsDragging(false);
    setIsUploading(false);
    setValidationError(null);
    setToast(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleFileSelected(selected: File | null | undefined) {
    if (!selected) return;
    if (!isSupportedSpreadsheetFile(selected)) {
      setToast({ type: 'error', message: 'Please select a .csv or .xlsx file.' });
      return;
    }

    let headerColumns: string[];
    try {
      headerColumns = await extractFileHeaders(selected);
    } catch {
      setToast({ type: 'error', message: 'Could not read this file. Please check the format and try again.' });
      return;
    }

    if (headerColumns.length === 0) {
      setToast({ type: 'error', message: 'Could not read any columns from this file.' });
      return;
    }

    setToast(null);
    setFile(selected);
    setColumns(headerColumns);
    setMapping(autoMatchColumns(headerColumns, REQUIRED_FIELDS));
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelected(e.dataTransfer.files?.[0]);
  }

  function clearFile() {
    setFile(null);
    setColumns([]);
    setMapping({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function setFieldMapping(fieldKey: string, column: string) {
    setMapping((prev) => {
      const next = { ...prev };
      if (column) {
        next[fieldKey] = column;
      } else {
        delete next[fieldKey];
      }
      return next;
    });
  }

  function goToStep2() {
    if (!file || !partnerId || columns.length === 0) return;
    setValidationError(null);
    setStep(2);
  }

  function goToStep3() {
    const missing = REQUIRED_FIELDS.filter((f) => f.required && !mapping[f.key]);
    if (missing.length > 0) {
      setValidationError(
        `Please map the required field${missing.length === 1 ? '' : 's'}: ${missing.map((f) => f.label).join(', ')}`
      );
      return;
    }
    setValidationError(null);
    setToast(null);
    setStep(3);
  }

  function goBack() {
    setValidationError(null);
    setStep((s) => (s === 3 ? 2 : 1) as Step);
  }

  async function handleExecuteImport() {
    if (!file || !partnerId) return;
    setIsUploading(true);
    setToast(null);
    try {
      const result = await uploadBookingsCsv(file, partnerId, mapping);
      const partnerName = PARTNERS.find((p) => p.id === partnerId)?.name ?? 'partner';
      let message = `Successfully imported ${result.imported} booking${result.imported === 1 ? '' : 's'} for ${partnerName}`;
      if (result.skipped.length > 0) {
        message += ` (${result.skipped.length} row${result.skipped.length === 1 ? '' : 's'} skipped)`;
      }
      await refreshData();
      setToast({ type: 'success', message });
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to upload the CSV file',
      });
    } finally {
      setIsUploading(false);
    }
  }

  const mappedRequiredCount = REQUIRED_FIELDS.filter((f) => f.required && mapping[f.key]).length;
  const mappedTotalCount = REQUIRED_FIELDS.filter((f) => mapping[f.key]).length;
  const requiredTotal = REQUIRED_FIELDS.filter((f) => f.required).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Import Bookings Wizard</h2>
            <p className="text-xs text-slate-400">
              Step {step} of 3 — {STEP_LABELS[step]}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 pt-4">
          {([1, 2, 3] as Step[]).map((s, idx) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step === s
                    ? 'bg-blue-600 text-white'
                    : step > s
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {step > s ? '✓' : s}
              </div>
              {idx < 2 && <div className={`h-0.5 flex-1 ${step > s ? 'bg-emerald-200' : 'bg-slate-100'}`} />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                Partner
                <select
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                >
                  {PARTNERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition ${
                  isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => handleFileSelected(e.target.files?.[0])}
                />
                <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 8.25 12 3.75 7.5 8.25M12 3.75v13.5" />
                </svg>
                {file ? (
                  <>
                    <p className="text-sm font-medium text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-400">{columns.length} column{columns.length === 1 ? '' : 's'} detected</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Drag and drop a CSV or XLSX file here, or <span className="font-medium text-blue-600">browse</span>
                  </p>
                )}
              </div>

              {file && (
                <button
                  type="button"
                  onClick={clearFile}
                  className="self-start text-sm font-medium text-slate-500 hover:underline"
                >
                  Remove file
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-500">
                Match each HeyMax field to the corresponding column from <span className="font-medium text-slate-700">{file?.name}</span>.
                Fields marked with <span className="text-red-500">*</span> are required.
              </p>

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="grid grid-cols-2 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <div>HeyMax Field</div>
                  <div>Uploaded Column</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {REQUIRED_FIELDS.map((field) => (
                    <div key={field.key} className="grid grid-cols-2 items-center px-4 py-3">
                      <div className="text-sm font-medium text-slate-700">
                        {field.label}
                        {field.required && <span className="ml-1 text-red-500">*</span>}
                      </div>
                      <select
                        className={`rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                          field.required && !mapping[field.key]
                            ? 'border-red-300 text-red-600'
                            : 'border-slate-300 text-slate-800'
                        }`}
                        value={mapping[field.key] ?? ''}
                        onChange={(e) => setFieldMapping(field.key, e.target.value)}
                      >
                        <option value="">— Not mapped —</option>
                        {columns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Mapped {mappedRequiredCount} of {requiredTotal} required parameters
                {mappedTotalCount > mappedRequiredCount ? ` (${mappedTotalCount} total fields mapped)` : ''} successfully.
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Partner</p>
                  <p className="mt-1 font-medium text-slate-700">
                    {PARTNERS.find((p) => p.id === partnerId)?.name ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">File</p>
                  <p className="mt-1 font-medium text-slate-700">{file?.name}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="grid grid-cols-2 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <div>HeyMax Field</div>
                  <div>Uploaded Column</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {REQUIRED_FIELDS.map((field) => (
                    <div key={field.key} className="grid grid-cols-2 items-center px-4 py-2.5 text-sm">
                      <div className="font-medium text-slate-700">
                        {field.label}
                        {field.required && <span className="ml-1 text-red-500">*</span>}
                      </div>
                      <div className={mapping[field.key] ? 'text-slate-600' : 'text-slate-400'}>
                        {mapping[field.key] ?? 'Not mapped'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {toast && (
                <div
                  className={`flex items-center justify-between gap-3 rounded-lg px-4 py-2 text-sm ${
                    toast.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                  }`}
                >
                  <span>{toast.message}</span>
                  <button type="button" onClick={() => setToast(null)} className="text-xs font-medium opacity-60 hover:opacity-100">
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}

          {validationError && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">
              <span>{validationError}</span>
              <button type="button" onClick={() => setValidationError(null)} className="text-xs font-medium opacity-60 hover:opacity-100">
                Dismiss
              </button>
            </div>
          )}

          {step === 1 && toast && (
            <div
              className={`mt-4 flex items-center justify-between gap-3 rounded-lg px-4 py-2 text-sm ${
                toast.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
              }`}
            >
              <span>{toast.message}</span>
              <button type="button" onClick={() => setToast(null)} className="text-xs font-medium opacity-60 hover:opacity-100">
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={step === 1 ? handleClose : goBack}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step === 1 && (
            <button
              type="button"
              onClick={goToStep2}
              disabled={!file || !partnerId}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next: Map Fields
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              onClick={goToStep3}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Next: Review
            </button>
          )}
          {step === 3 && (
            toast?.type === 'success' ? (
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isUploading}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading ? 'Importing…' : 'Execute Import'}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
