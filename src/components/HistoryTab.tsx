import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { History as HistoryIcon, ChevronDown, ChevronUp, Trash2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ExplanationRenderer from './ExplanationRenderer';

interface HistoryItem {
  id: string;
  document_name: string;
  score: number;
  total_questions: number;
  created_at: string;
  user_responses?: Record<string, string[]>;
  questions_snapshot?: {
    id: string;
    question_text: string;
    options: Record<string, string>;
    correct_answers: string[];
    explanation?: string;
  }[];
}

const HistoryTab: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('exam_history')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setHistory(data);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const clearHistory = async (id: string) => {
    if (!confirm('Purge this record?')) return;
    await supabase.from('exam_history').delete().eq('id', id);
    fetchHistory();
  };

  const normalizeAnswers = (ans: string | string[]): string[] => {
    const text = Array.isArray(ans) ? ans.join(',') : String(ans || '');
    return ((text.toUpperCase().match(/[A-Z0-9]+/g) || []) as string[])
      .filter(m => m.length === 1)
      .map(s => s.trim())
      .filter(Boolean)
      .sort();
  };

  return (
    <div className="space-y-10 animate-fade-in p-4 sm:p-0">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
          <HistoryIcon size={24} className="text-indigo-400" />
        </div>
        <div>
          <h3 className="text-2xl font-black text-white uppercase italic">Historical Matrix</h3>
          <p className="text-[10px] font-black text-muted tracking-widest uppercase">Performance Log Archive</p>
        </div>
      </div>

      <div className="space-y-6">
        {history.map((item) => (
          <div key={item.id} className="glass-card overflow-hidden border-white/5">
            <div className="p-6 flex flex-col sm:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-6">
                <div className="text-center bg-white/5 p-3 px-5 rounded-2xl border border-white/5">
                  <div className="text-xl font-black text-white">{item.score}</div>
                  <div className="text-[9px] font-black text-muted uppercase">SCORE</div>
                </div>
                <div>
                  <h4 className="font-bold text-white tracking-tight">{item.document_name}</h4>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{new Date(item.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                 <button 
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="primary-btn flex items-center gap-2"
                >
                  {expandedId === item.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  ANALYZE
                </button>
                <button 
                  onClick={() => clearHistory(item.id)}
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-xl transition-all border border-white/5"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {expandedId === item.id && item.questions_snapshot && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-black/40 border-t border-white/5 p-8"
                >
                  <div className="space-y-16">
                    {item.questions_snapshot.map((q, qIdx) => {
                      const uAns = item.user_responses?.[q.id] || [];
                      const normUser = normalizeAnswers(uAns);
                      const normCorrect = normalizeAnswers(q.correct_answers);
                      const isCorrect = normUser.length === normCorrect.length && normUser.every((a, i) => a === normCorrect[i]);

                      return (
                        <div key={q.id} className="space-y-6">
                          <div className={`w-full p-8 rounded-2xl text-left shadow-xl font-question leading-relaxed ${isCorrect ? 'history-question-correct' : 'history-question-wrong'}`}>
                            <div className="flex justify-between items-center mb-4 opacity-70 font-option">
                              <span className="text-[10px] font-black uppercase tracking-widest">LOG NODE #{qIdx + 1}</span>
                              <span className="text-[10px] font-black uppercase">{isCorrect ? 'VALIDATED ✓' : 'FAILED ✗'}</span>
                            </div>
                            <ExplanationRenderer text={q.question_text} />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(q.options || {}).map(([key, val]) => {
                              const isCorrectOpt = normCorrect.includes(key);
                              const isSelected = uAns.includes(key);
                              let btnCls = 'history-opt-neutral';
                              if (isCorrectOpt) btnCls = 'history-opt-correct';
                              else if (isSelected && !isCorrectOpt) btnCls = 'history-opt-wrong-selected';

                              return (
                                <div key={key} className={`p-5 rounded-2xl border font-option flex items-start gap-4 text-left transition-all ${btnCls}`}>
                                  <span className="w-6 h-6 rounded bg-black/20 flex items-center justify-center text-[10px] shrink-0 font-black">{key}</span>
                                  <span className="grow"><ExplanationRenderer text={val as string} /></span>
                                </div>
                              );
                            })}
                          </div>

                          {q.explanation && (
                            <div className="w-full p-6 bg-slate-900 border border-white/10 rounded-2xl text-left text-quiz font-medium text-slate-300 flex gap-4 items-start shadow-inner">
                              <Info size={20} className="text-indigo-400 shrink-0 mt-0.5" />
                              <div>
                                <span className="block text-[9px] font-black uppercase text-indigo-400 tracking-widest mb-1 italic">Retrospective Intelligence</span>
                                <ExplanationRenderer text={q.explanation} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryTab;
