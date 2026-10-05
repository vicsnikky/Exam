import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Complaint,
  fetchExecutiveComplaints,
  updateComplaintStatus,
  forwardComplaintToDirector,
} from '../lib/complaintsStore.ts';
import { FIS_LOGOS } from '../constants/branding.ts';
import {
  MessageSquareWarning,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Archive,
  RefreshCw,
  FileSpreadsheet,
  Lock,
  ChevronRight,
  Eye,
  MessageCircle,
  Building2,
  UserCheck,
  Share2,
  Send,
  ArrowRight
} from 'lucide-react';

export const ExecutiveComplaintsManager: React.FC = () => {
  const { token, user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  // Status update & forwarding state
  const [editingNotes, setEditingNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [forwardingNotes, setForwardingNotes] = useState('');
  const [forwardingLoading, setForwardingLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isSuperAdmin = user?.role === 'super_admin';
  const isPrincipal = user?.role === 'principal';
  const isDirector = user?.role === 'director';
  const canForwardToDirector = isSuperAdmin || isPrincipal;

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const list = await fetchExecutiveComplaints(token, user?.role);
      // If user is School Director, only display complaints forwarded to the Director
      const visibleList = isDirector ? list.filter((c) => c.forwardedToDirector === true) : list;
      setComplaints(visibleList);
      if (selectedComplaint) {
        const refreshed = visibleList.find((c) => c.referenceCode === selectedComplaint.referenceCode);
        setSelectedComplaint(refreshed || null);
      }
    } catch (err) {
      console.warn('Failed to load executive complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints();

    const handleUpdate = () => {
      loadComplaints();
    };
    window.addEventListener('fis:complaints-updated', handleUpdate);
    return () => window.removeEventListener('fis:complaints-updated', handleUpdate);
  }, [token, user?.role]);

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;
      if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesRef = c.referenceCode.toLowerCase().includes(q);
        const matchesSubj = c.subject.toLowerCase().includes(q);
        const matchesMsg = c.message.toLowerCase().includes(q);
        const matchesCat = c.category.toLowerCase().includes(q);
        if (!matchesRef && !matchesSubj && !matchesMsg && !matchesCat) return false;
      }
      return true;
    });
  }, [complaints, selectedStatus, selectedCategory, searchQuery]);

  const handleUpdateStatus = async (newStatus: 'pending' | 'under_review' | 'resolved' | 'archived') => {
    if (!selectedComplaint) return;
    setUpdating(true);
    try {
      await updateComplaintStatus(selectedComplaint.referenceCode, newStatus, editingNotes, token);
      setFeedbackMsg({
        type: 'success',
        text: `Status for ${selectedComplaint.referenceCode} updated to "${newStatus.replace('_', ' ').toUpperCase()}".`,
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
      loadComplaints();
    } catch (e: any) {
      setFeedbackMsg({ type: 'error', text: e.message || 'Failed to update status' });
    } finally {
      setUpdating(false);
    }
  };

  const handleForwardToDirector = async () => {
    if (!selectedComplaint) return;
    setForwardingLoading(true);
    try {
      const forwarderTitle = isSuperAdmin
        ? `Super Administrator (${user?.firstName || 'Victor Alo'})`
        : `School Principal (${user?.firstName || 'Principal'})`;

      await forwardComplaintToDirector(
        selectedComplaint.referenceCode,
        forwardingNotes.trim() || undefined,
        forwarderTitle,
        token
      );

      setFeedbackMsg({
        type: 'success',
        text: `Complaint ${selectedComplaint.referenceCode} has been successfully forwarded to the School Director's dashboard.`,
      });
      setForwardingNotes('');
      setTimeout(() => setFeedbackMsg(null), 5000);
      await loadComplaints();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to forward complaint to Director',
      });
    } finally {
      setForwardingLoading(false);
    }
  };

  const pendingCount = complaints.filter((c) => c.status === 'pending').length;
  const underReviewCount = complaints.filter((c) => c.status === 'under_review').length;
  const resolvedCount = complaints.filter((c) => c.status === 'resolved').length;
  const forwardedCount = complaints.filter((c) => c.forwardedToDirector === true).length;

  const handleExportCSV = () => {
    if (filteredComplaints.length === 0) return;
    const headers = ['Reference Code', 'Category', 'Priority', 'Subject', 'Message', 'Status', 'Forwarded to Director', 'Forwarded By', 'Executive Notes', 'Submitted Date', 'Resolved Date'];
    const rows = filteredComplaints.map((c) => [
      `"${c.referenceCode}"`,
      `"${c.category}"`,
      `"${c.priority}"`,
      `"${c.subject.replace(/"/g, '""')}"`,
      `"${c.message.replace(/"/g, '""')}"`,
      `"${c.status}"`,
      `"${c.forwardedToDirector ? 'Yes' : 'No'}"`,
      `"${(c.forwardedBy || 'N/A').replace(/"/g, '""')}"`,
      `"${(c.executiveNotes || '').replace(/"/g, '""')}"`,
      `"${c.createdAt}"`,
      `"${c.resolvedAt || 'N/A'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FIS_Executive_Complaints_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/30 p-6 rounded-2xl shadow-xl fis-card-accent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <MessageSquareWarning className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  {isDirector ? 'Directorate Executive Records' : 'Two-Tier Confidential Portal'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  isDirector
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  {isDirector ? 'DIRECTORATE DASHBOARD • FORWARDED ONLY' : 'SUPER ADMIN & PRINCIPAL FIRST'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">
                {isDirector
                  ? "Director's Grievance & Complaints Directorate"
                  : 'Anonymous Suggestion & Complaint Box Records'}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                {isDirector
                  ? 'Showing submissions vetted and forwarded by the Super Administrator and School Principal for proprietor decisions.'
                  : 'Complaints are delivered to the Super Admin and Principal first. Only the Super Admin and Principal can forward them to the Director.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadComplaints}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExportCSV}
              disabled={filteredComplaints.length === 0}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-medium block">
            {isDirector ? 'Forwarded to Director' : 'Total Submissions'}
          </span>
          <span className="text-2xl font-bold text-white font-mono mt-1 block">{complaints.length}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {isDirector ? 'Executive Directorate Inbox' : 'Super Admin & Principal'}
          </span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
          <span className="text-[11px] text-amber-400 font-medium block">Pending Review</span>
          <span className="text-2xl font-bold text-amber-300 font-mono mt-1 block">{pendingCount}</span>
          <span className="text-[10px] text-amber-400/80 mt-0.5 block">Awaiting Assessment</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
          <span className="text-[11px] text-purple-400 font-medium block">
            {isDirector ? 'Active Investigation' : 'Forwarded to Director'}
          </span>
          <span className="text-2xl font-bold text-purple-300 font-mono mt-1 block">
            {isDirector ? underReviewCount : forwardedCount}
          </span>
          <span className="text-[10px] text-purple-400/80 mt-0.5 block">
            {isDirector ? 'Directorate Review' : 'Sent to School Director'}
          </span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
          <span className="text-[11px] text-emerald-400 font-medium block">Resolved</span>
          <span className="text-2xl font-bold text-emerald-300 font-mono mt-1 block">{resolvedCount}</span>
          <span className="text-[10px] text-emerald-400/80 mt-0.5 block">Addressed & Closed</span>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
          }`}
        >
          {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Main Grid: List + Detail Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Filterable List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reference code, subject, or keywords..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 text-[11px] font-semibold">Status:</span>
              {(['all', 'pending', 'under_review', 'resolved', 'archived'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition cursor-pointer border ${
                    selectedStatus === st
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* List Items */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-700/60 shadow-lg">
            {filteredComplaints.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <MessageSquareWarning className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-medium text-slate-300">
                  {isDirector
                    ? 'No complaints have been forwarded to the Director yet'
                    : 'No anonymous submissions found'}
                </p>
                <p className="text-xs mt-1">
                  {isDirector
                    ? 'Complaints are delivered directly to the Super Admin and Principal first. They will appear here once forwarded.'
                    : 'Submissions sent via the suggestion box appear here for the Super Admin and Principal.'}
                </p>
              </div>
            ) : (
              filteredComplaints.map((c) => (
                <div
                  key={c.referenceCode}
                  onClick={() => {
                    setSelectedComplaint(c);
                    setEditingNotes(c.executiveNotes || '');
                    setForwardingNotes('');
                  }}
                  className={`p-4 hover:bg-slate-700/40 transition cursor-pointer flex items-start justify-between gap-3 ${
                    selectedComplaint?.referenceCode === c.referenceCode
                      ? 'bg-slate-700/60 border-l-4 border-amber-400'
                      : ''
                  }`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {c.referenceCode}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          c.priority === 'Urgent'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : c.priority === 'Important'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {c.priority}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                          c.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-300'
                            : c.status === 'under_review'
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : c.status === 'resolved'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-600/30 text-slate-400'
                        }`}
                      >
                        {c.status.replace('_', ' ')}
                      </span>

                      {/* Forwarded to Director status pill */}
                      {c.forwardedToDirector ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                          <Share2 className="w-2.5 h-2.5" />
                          Forwarded to Director
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-slate-400 border border-slate-700 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5 text-amber-400" />
                          Super Admin & Principal First
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-semibold text-white truncate">{c.subject}</h4>
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{c.message}</p>

                    <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1">
                      <span>{c.category}</span>
                      <span>•</span>
                      <span>{new Date(c.createdAt).toLocaleDateString()} at {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {c.forwardedBy && (
                        <>
                          <span>•</span>
                          <span className="text-purple-300">By: {c.forwardedBy}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 mt-2" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Selected Complaint Detail & Executive Actions */}
        <div className="lg:col-span-5">
          {selectedComplaint ? (
            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 space-y-4 shadow-xl sticky top-24">
              <div className="flex items-start justify-between gap-2 border-b border-slate-700/80 pb-3">
                <div>
                  <span className="text-[11px] font-mono font-bold text-amber-400 block">
                    {selectedComplaint.referenceCode}
                  </span>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    {selectedComplaint.subject}
                  </h3>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                    selectedComplaint.priority === 'Urgent'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : selectedComplaint.priority === 'Important'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {selectedComplaint.priority}
                </span>
              </div>

              {/* Meta information */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-700/60">
                <div>
                  <span className="text-slate-400 block text-[10px]">Category</span>
                  <span className="text-white font-medium">{selectedComplaint.category}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Received</span>
                  <span className="text-white font-medium">{new Date(selectedComplaint.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Initial Routing</span>
                  <span className="text-amber-300 font-medium">Super Admin & Principal</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Current Status</span>
                  <span className="text-emerald-400 font-bold capitalize">{selectedComplaint.status.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Director Forwarding Status / Forwarding Action */}
              {selectedComplaint.forwardedToDirector ? (
                <div className="p-3.5 bg-purple-950/40 border border-purple-500/40 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                    <Share2 className="w-4 h-4 text-purple-400" />
                    Forwarded to School Director's Dashboard
                  </div>
                  <div className="text-[11px] text-slate-300 leading-normal">
                    <span>Forwarded by: </span>
                    <strong className="text-white">{selectedComplaint.forwardedBy || 'Super Admin / Principal'}</strong>
                    {selectedComplaint.forwardedAt && (
                      <span className="text-slate-400 block mt-0.5">
                        Date: {new Date(selectedComplaint.forwardedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {selectedComplaint.forwardingNotes && (
                    <div className="text-[11px] bg-slate-900/90 p-2.5 rounded-lg border border-purple-500/20 text-purple-200 mt-1.5">
                      <span className="text-[10px] text-purple-400 font-semibold block uppercase">
                        Executive Forwarding Notes:
                      </span>
                      {selectedComplaint.forwardingNotes}
                    </div>
                  )}
                </div>
              ) : canForwardToDirector ? (
                <div className="p-3.5 bg-amber-950/30 border border-amber-500/40 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Share2 className="w-4 h-4 text-amber-400" />
                      Forward to School Director's Dashboard
                    </span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-semibold">
                      Super Admin & Principal Authority
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    This complaint is currently restricted to the Super Administrator and Principal. Forwarding will make it visible in the School Director's executive dashboard.
                  </p>
                  <textarea
                    rows={2}
                    value={forwardingNotes}
                    onChange={(e) => setForwardingNotes(e.target.value)}
                    placeholder="Optional directive or executive summary notes for the Director..."
                    className="w-full bg-slate-900 border border-amber-500/30 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                  />
                  <button
                    type="button"
                    disabled={forwardingLoading}
                    onClick={handleForwardToDirector}
                    className="w-full py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 transition cursor-pointer disabled:opacity-50"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {forwardingLoading ? 'Forwarding to Director...' : 'Forward to Director’s Dashboard'}
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Only the Super Administrator and Principal have authority to forward complaints to the Director.</span>
                </div>
              )}

              {/* Full Message */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Anonymous Message Body:
                </label>
                <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-700 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {selectedComplaint.message}
                </div>
              </div>

              {/* Executive Notes Input */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Confidential Executive Leadership Notes:
                </label>
                <textarea
                  rows={3}
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="Record findings, directives to management, or resolution actions taken by Super Admin, Principal, or Director..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-700/80">
                <span className="text-[11px] text-slate-400 font-semibold block">Change Investigation Status:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    disabled={updating}
                    onClick={() => handleUpdateStatus('under_review')}
                    className="py-2 px-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Investigating
                  </button>
                  <button
                    disabled={updating}
                    onClick={() => handleUpdateStatus('resolved')}
                    className="py-2 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Mark Resolved
                  </button>
                  <button
                    disabled={updating}
                    onClick={() => handleUpdateStatus('archived')}
                    className="py-2 px-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Archive
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-8 text-center text-slate-400">
              <Eye className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-xs font-semibold text-slate-300">Select any submission</p>
              <p className="text-[11px] mt-1 text-slate-400">
                Click an anonymous complaint or suggestion from the left to read full details, assign status, and write confidential notes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

