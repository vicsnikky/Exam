import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  type: 'student' | 'teacher' | 'user';
  title: string;
  name: string;
  identifier: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  type,
  title,
  name,
  identifier,
  onConfirm,
  onClose,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to delete record');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <button
              onClick={onClose}
              disabled={deleting}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Are you sure you want to permanently delete this {type}? This will remove all associated grades,
              attendance, and portal access credentials.
            </p>

            {/* Target Card */}
            <div className="mt-4 p-3.5 rounded-xl bg-slate-950/90 border border-rose-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">{name}</p>
                  <p className="text-[11px] font-mono text-amber-400">{identifier}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                  {type}
                </span>
              </div>
            </div>

            {error && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-950/50 border border-rose-600/50 text-rose-300 text-xs">
                {error}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={deleting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition cursor-pointer shadow-lg shadow-rose-700/30 disabled:opacity-60"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Delete</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
