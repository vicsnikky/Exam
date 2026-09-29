import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Copy, Check, ShieldCheck, UserCheck, ArrowRight, X } from 'lucide-react';

interface RegistrationSuccessCardProps {
  type: 'student' | 'teacher';
  name: string;
  uniqueId: string;
  roleOrClass: string;
  email?: string;
  password?: string;
  school?: string;
  onDismiss?: () => void;
  onViewList?: () => void;
}

export const RegistrationSuccessCard: React.FC<RegistrationSuccessCardProps> = ({
  type,
  name,
  uniqueId,
  roleOrClass,
  email,
  password,
  school = 'Fenster International School',
  onDismiss,
  onViewList,
}) => {
  const [copied, setCopied] = useState(false);

  const credentialsText = `=== FENSTER INTERNATIONAL SCHOOL ===\nOFFICIAL ${type === 'student' ? 'STUDENT' : 'FACULTY'} CREDENTIALS\nName: ${name}\nID: ${uniqueId}\n${type === 'student' ? 'Class' : 'Role'}: ${roleOrClass}\n${email ? `Email: ${email}\n` : ''}${password ? `Password: ${password}\n` : ''}School: ${school}\nPortal: https://fisresult.vercel.app`;

  const handleCopy = () => {
    navigator.clipboard.writeText(credentialsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-emerald-950/90 via-slate-900/95 to-slate-950 border-2 border-emerald-500 shadow-2xl relative overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition cursor-pointer"
          title="Dismiss notice"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400 shadow-lg shadow-emerald-500/20">
          <CheckCircle2 className="w-7 h-7" />
        </div>

        <div className="flex-1 w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              Registration Successful
            </span>
            <span className="text-xs text-slate-400">Recorded & Active</span>
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-white mt-1">
            {type === 'student' ? 'Student Registration Complete' : 'Faculty Member Successfully Provisioned'}
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            {name} has been enrolled into the official institutional roster.
          </p>

          {/* Credentials Box */}
          <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-emerald-500/30 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-left">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {type === 'student' ? 'Official Student ID' : 'Faculty Teacher ID'}
              </p>
              <p className="text-sm font-mono font-bold text-amber-300 select-all">{uniqueId}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Full Legal Name</p>
              <p className="text-sm font-semibold text-white truncate">{name}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {type === 'student' ? 'Assigned Class' : 'System Role'}
              </p>
              <p className="text-sm font-medium text-slate-200">{roleOrClass}</p>
            </div>

            {password && (
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Login Password</p>
                <p className="text-sm font-mono font-bold text-emerald-300 select-all">{password}</p>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer shadow-md shadow-emerald-700/30"
            >
              {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Credentials Copied to Clipboard!' : 'Copy Full Credentials'}
            </button>

            {onViewList && (
              <button
                onClick={onViewList}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
              >
                <span>{type === 'student' ? 'View in Students Directory' : 'View in Faculty Chamber'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
