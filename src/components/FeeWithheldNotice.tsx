import React from 'react';
import { Lock, ShieldAlert, CreditCard, Building2, Phone, Mail } from 'lucide-react';
import { FIS_LOGOS } from '../constants/branding.ts';

interface FeeWithheldNoticeProps {
  studentName?: string;
  studentId?: string;
  reason?: string;
  breakdown?: {
    baseClassFee?: number;
    hostelFee?: number;
    scholarshipDiscount?: number;
    netRequiredFee?: number;
    amountPaid?: number;
    balanceDue?: number;
    residenceType?: string;
    scholarshipLabel?: string;
  };
}

export const FeeWithheldNotice: React.FC<FeeWithheldNoticeProps> = ({
  studentName,
  studentId,
  reason,
  breakdown,
}) => {
  return (
    <div className="bg-slate-900 border-2 border-rose-500/40 rounded-3xl p-8 sm:p-12 text-center max-w-3xl mx-auto shadow-2xl relative overflow-hidden">
      {/* Background Crest watermark */}
      <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center">
        <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-96 w-auto" />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Lock Shield Icon */}
        <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border-2 border-rose-500/60 text-rose-400 mx-auto flex items-center justify-center shadow-lg shadow-rose-950/50">
          <Lock className="w-10 h-10" />
        </div>

        <div>
          <span className="px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            Bursary Clearance Required
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-3 tracking-tight">
            Academic Examination Results Withheld
          </h2>
          <p className="text-sm text-slate-300 mt-2 max-w-xl mx-auto">
            Official terminal report cards, continuous assessment ledgers, and SS3 weekly mock examination results are temporarily restricted due to outstanding school fees.
          </p>
        </div>

        {/* Student identification badge */}
        {(studentName || studentId) && (
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 max-w-md mx-auto text-xs text-slate-300 flex items-center justify-between">
            <div className="text-left">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Scholar Name</span>
              <strong className="text-white text-sm">{studentName || 'Student'}</strong>
            </div>
            {studentId && (
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Unique Student ID</span>
                <span className="text-amber-400 font-mono font-bold">{studentId}</span>
              </div>
            )}
          </div>
        )}

        {reason && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-200 max-w-md mx-auto">
            <strong>Bursary Note:</strong> {reason}
          </div>
        )}

        {/* Itemized Bursary Statement Breakdown */}
        {breakdown && (
          <div className="bg-slate-950/80 border border-slate-700/80 rounded-2xl p-5 max-w-md mx-auto text-xs text-left space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                Fee Breakdown & Clearance Ledger
              </span>
              {breakdown.residenceType === 'hostel' ? (
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold">
                  🛏️ Boarder (Hostel)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                  🏠 Day Scholar
                </span>
              )}
            </div>

            <div className="space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Class Tuition:</span>
                <span className="font-mono">₦{(breakdown.baseClassFee || 0).toLocaleString()}</span>
              </div>

              {(breakdown.hostelFee || 0) > 0 && (
                <div className="flex justify-between text-indigo-300">
                  <span>Hostel Accommodation:</span>
                  <span className="font-mono">+₦{breakdown.hostelFee?.toLocaleString()}</span>
                </div>
              )}

              {(breakdown.scholarshipDiscount || 0) > 0 && (
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Scholarship Subsidy:</span>
                  <span className="font-mono">-₦{breakdown.scholarshipDiscount?.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between border-t border-slate-800 pt-1.5 font-bold text-white">
                <span>Net Required Fee:</span>
                <span className="font-mono">₦{(breakdown.netRequiredFee || 0).toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-emerald-400">
                <span>Total Paid to Date:</span>
                <span className="font-mono">₦{(breakdown.amountPaid || 0).toLocaleString()}</span>
              </div>

              <div className="flex justify-between border-t border-rose-500/40 pt-1.5 font-extrabold text-rose-400 text-sm">
                <span>Outstanding Balance Due:</span>
                <span className="font-mono">₦{(breakdown.balanceDue || 0).toLocaleString()}</span>
              </div>
            </div>

            {breakdown.scholarshipLabel && breakdown.scholarshipLabel !== 'No Scholarship' && (
              <div className="pt-2 border-t border-slate-800 text-[11px] text-emerald-400/90 font-medium flex items-center gap-1.5">
                <span>🎓 Subsidy Status:</span>
                <span>{breakdown.scholarshipLabel}</span>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 text-left text-xs text-slate-300 space-y-3 max-w-xl mx-auto">
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase text-[11px]">
            <CreditCard className="w-4 h-4" />
            <span>How to Unlock Your Results</span>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-slate-300 text-xs">
            <li>
              Visit the <strong>Fenster International School Bursary Department / Accounts Office</strong> on campus.
            </li>
            <li>
              Settle outstanding term tuition fees or present your bank deposit teller / transfer receipt for validation.
            </li>
            <li>
              The Bursar or Super Admin will issue instant financial clearance, automatically unlocking your report cards on this portal.
            </li>
          </ol>
        </div>

        <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-center gap-6">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            Bursary & Accounts Directorate
          </span>
          <span className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-slate-500" />
            bursar@fensterschool.edu
          </span>
        </div>
      </div>
    </div>
  );
};
