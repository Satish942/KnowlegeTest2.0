import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database, Copy, CheckCircle2, ChevronRight, ChevronDown, Binary, FileJson } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Question {
  id: string;
  question_text: string;
  correct_answers: string[];
  options: Record<string, string>;
  is_multi: boolean;
  max_selections?: number;
  explanation?: string;
}

const DataStructureTab: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const fetchDocuments = async () => {
    const { data } = await supabase.from('documents').select('*');
    if (data) setDocuments(data);
  };

  const fetchQuestions = async (docId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('document_id', docId)
      .order('created_at', { ascending: true });
    if (data) setQuestions(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (selectedDocId) fetchQuestions(selectedDocId);
    else setQuestions([]);
  }, [selectedDocId]);

  const copyToClipboard = () => {
    const dataString = JSON.stringify(questions, null, 2);
    navigator.clipboard.writeText(dataString);
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-10 animate-fade-in p-4 sm:p-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 px-4">
        <div className="flex items-center gap-4 grow max-w-2xl">
          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
            <Binary size={24} className="text-indigo-400" />
          </div>
          <div className="grow">
            <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-2 mb-2">
              <h3 className="text-2xl font-black text-white tracking-tight uppercase italic">Schema Inspector</h3>
              {questions.length > 0 && <span className="text-[10px] font-black text-muted tracking-[0.2em] uppercase">{questions.length} Nodes Identified</span>}
            </div>
            <select 
              className="input-field mb-0 bg-slate-950/50 border-white/10 focus:border-indigo-500/50"
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
            >
              <option value="">Debug Source Target...</option>
              {documents.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {questions.length > 0 && (
          <button 
            onClick={copyToClipboard}
            className="secondary-btn"
          >
            {copyStatus === 'copied' ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={16} />}
            {copyStatus === 'copied' ? 'EXPORTED TO BUFFER' : 'EXPORT RAW SCHEMA'}
          </button>
        )}
      </div>

      {!selectedDocId && (
        <div className="py-40 text-center glass-card border-dashed border-white/5 opacity-40">
          <Database size={48} className="mx-auto text-slate-700 mb-4" />
          <p className="text-slate-500 font-black uppercase tracking-[0.4em] text-[10px]">Awaiting Signal Input</p>
        </div>
      )}

      {loading && (
        <div className="py-40 text-center">
          <div className="animate-spin inline-block w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full shadow-[0_0_15px_rgba(99,102,241,0.3)]"></div>
          <p className="mt-8 text-indigo-400 font-black uppercase tracking-widest text-[10px] animate-pulse">Scanning Metadata Matrix...</p>
        </div>
      )}

      {!loading && questions.length > 0 && (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
          <div className="glass-card p-10 bg-slate-950/40 border-white/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
            <h3 className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400 mb-10 flex items-center gap-3">
              <FileJson size={14} /> Structural Registry Mapping
            </h3>
            
            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div key={q.id} className="border border-white/5 rounded-2xl overflow-hidden bg-slate-950/20 hover:border-white/15 transition-all">
                  <button 
                    onClick={() => toggleExpand(q.id)}
                    className="w-full flex items-center justify-between p-5 hover:bg-white/5 text-left transition-colors"
                  >
                    <div className="flex items-center gap-5">
                      <span className="text-[10px] font-black font-mono text-slate-600 bg-black/40 px-2 py-1 rounded border border-white/5 tracking-tighter">#{String(idx + 1).padStart(3, '0')}</span>
                      <span className="font-mono text-[10px] text-indigo-400/60 hidden sm:inline tracking-tighter">UUID_{q.id.substring(0, 8).toUpperCase()}</span>
                      <span className="font-bold text-sm text-slate-200 truncate max-w-[150px] sm:max-w-md">
                        {q.question_text}
                      </span>
                    </div>
                    {expandedItems[q.id] ? <ChevronDown size={18} className="text-indigo-400" /> : <ChevronRight size={18} className="text-slate-600" />}
                  </button>
                  
                  <AnimatePresence>
                    {expandedItems[q.id] && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-black/60 border-t border-white/5"
                      >
                        <div className="p-8">
                          <pre className="text-[11px] leading-relaxed font-mono text-indigo-300 overflow-x-auto whitespace-pre no-scrollbar">
                            {JSON.stringify({
                              id: q.id,
                              text: q.question_text,
                              options: q.options,
                              correctAnswers: q.correct_answers,
                              isMulti: q.is_multi,
                              maxSelections: q.max_selections,
                              explanation: q.explanation
                            }, null, 3)}
                          </pre>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataStructureTab;
