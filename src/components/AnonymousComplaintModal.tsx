import React, { useState } from 'react';
import { FIS_LOGOS } from '../constants/branding.ts';
import { submitAnonymousComplaint } from '../lib/complaintsStore.ts';
import {
  MessageSquareWarning,
  ShieldCheck,
  Send,
  X,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Copy,
  Check,
  HelpCircle,
  Building2
} from 'lucide-react';

interface AnonymousComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  'General Suggestion & School Improvement',
  'Academic Curriculum & Teaching Quality',
  'School Facilities, Labs & Classrooms',
  'Bursary, Accounts & School Fees',
  'Staff / Faculty Conduct & Welfare',
  'Student Welfare, Safety & Discipline',
  'Examination, Mock & Grading Inquiries',
  'Other Confidential Matters',
];

export const AnonymousComplaintModal: React.FC<AnonymousComplaintModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState<'Routine' | 'Important' | 'Urgent'>('Routine');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError('Please provide both a subject title and details for your submission.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await submitAnonymousComplaint({
        category,
        priority,
        subject: subject.trim(),
        message: message.trim(),
        targetRole: 'Super Admin & Principal',
      });

      if (res.success) {
        setSubmittedRef(res.referenceCode);
      } else {
        setError('Submission failed. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error sending anonymous submission.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (!submittedRef) return;
    navigator.clipboard.writeText(submittedRef);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleResetAndClose = () => {
    setCategory(CATEGORIES[0]);
    setPriority('Routine');
    setSubject('');
    setMessage('');
    setError(null);
    setSubmittedRef(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <MessageSquareWarning className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Confidential Suggestion & Complaint Box
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>100% Anonymous • Delivered to Super Admin & Principal First</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleResetAndClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {submittedRef ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white">Submission Received Anonymously</h4>
                <p className="text-xs text-slate-300 max-w-md mx-auto mt-2 leading-relaxed">
                  Your message has been securely submitted and delivered directly to the <strong className="text-amber-300">Super Administrator & School Principal</strong> for initial investigation and action. No user account, name, or IP address was recorded.
                </p>
              </div>

              <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl max-w-sm mx-auto">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">
                  Anonymous Tracking Reference
                </span>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-lg font-mono font-bold text-amber-400 tracking-wider">
                    {submittedRef}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition cursor-pointer"
                    title="Copy Tracking ID"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Keep this tracking code if you wish to reference your submission.
                </span>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleResetAndClose}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition cursor-pointer shadow-lg shadow-emerald-900/30"
                >
                  Close Window
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Privacy Reassurance Banner */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-3.5 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white font-semibold">Two-Tier Executive Review Protocol: </strong>
                  Submissions are delivered directly to the <span className="text-amber-300 font-semibold">Super Administrator</span> and <span className="text-amber-300 font-semibold">School Principal</span> first. Only the Super Admin or Principal can escalate and forward submissions to the School Director's dashboard when executive proprietor decisions are required. Complete anonymity is guaranteed.
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Destination Banner */}
              <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">First-Tier Recipients:</span>
                <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  Super Administrator & School Principal
                </span>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Category / Area of Concern
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 transition"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Urgency / Priority Level
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(['Routine', 'Important', 'Urgent'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setPriority(lvl)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        priority === lvl
                          ? lvl === 'Urgent'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                            : lvl === 'Important'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      {lvl === 'Urgent' ? '🔴 ' : lvl === 'Important' ? '🟠 ' : '🟢 '}
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Subject / Summary Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Suggestion regarding laboratory equipment / SS3 mock timing"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 transition"
                />
              </div>

              {/* Message Details */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Detailed Complaint / Suggestion <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe your suggestion, inquiry, or complaint in detail. If referencing a specific class, subject, or facility, please mention it here..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 transition resize-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Do not include your own personal contact details unless you desire the leadership to know who you are.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2.5 text-slate-400 hover:text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/40 disabled:opacity-50"
                >
                  {submitting ? (
                    <span>Submitting...</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Anonymously</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

