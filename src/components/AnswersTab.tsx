import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle2, List } from 'lucide-react';
import ExplanationRenderer from './ExplanationRenderer';

interface Question {
  id: string;
  question_text: string;
  options: Record<string, string>;
  correct_answers: string[];
  explanation?: string;
}

interface Document {
  id: string;
  name: string;
  created_at: string;
}

const AnswersTab: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDocuments = async () => {
    const { data } = await supabase.from('documents').select('*');
    if (data) setDocuments(data);
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const loadAnswers = async () => {
    if (!selectedDocId) return;
    setLoading(true);
    const { data } = await supabase.from('questions').select('*').eq('document_id', selectedDocId);
    if (data) setQuestions(data);
    setLoading(false);
  };

  const normalizeAnswers = (ans: string | string[]): string[] => {
    const text = Array.isArray(ans) ? ans.join(',') : String(ans || '');
    return ((text.toUpperCase().match(/[A-Z0-9]+/g) || []) as string[]).filter(m => m.length === 1).map(s => s.trim()).filter(Boolean).sort();
  };

  return (
    <div className="space-y-12 p-4 sm:p-0 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
            <List size={24} className="text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black text-white uppercase italic">Solution Registry</h3>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <select className="input-field mb-0 bg-slate-900 border-white/10 flex-1 sm:w-64" value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)}>
            <option value="">Choose document...</option>
            {documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={loadAnswers} disabled={!selectedDocId || loading} className="primary-btn bg-emerald-600">
            {loading ? "LOAD..." : "VIEW ANSWERS"}
          </button>
        </div>
      </div>

      <div className="space-y-12 pb-40">
        {questions.map((q, idx) => {
          const nC = normalizeAnswers(q.correct_answers);
          return (
            <div key={q.id} className="space-y-4">
              <div className="w-full p-8 bg-emerald-600/10 border border-emerald-500/20 text-white rounded-2xl shadow-md text-left font-question">
                <span className="block text-[10px] font-black uppercase tracking-widest mb-3 text-emerald-500/60 font-option">NODE #{idx + 1}</span>
                <ExplanationRenderer text={q.question_text} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(q.options).map(([key, val]) => {
                  const isCorrect = nC.includes(key);
                  return (
                    <div key={key} className={`p-5 rounded-2xl border font-option text-left flex items-start gap-4 transition-all duration-300 ${
                      isCorrect ? 'bg-green-600 border-green-400/50 shadow-lg ring-2 ring-green-400/20' : 'bg-green-900/50 border-green-700/30'
                    }`}>
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] shrink-0 font-black border ${isCorrect ? 'bg-white text-green-600 border-transparent shadow-sm' : 'bg-green-800/60 text-green-300 border-green-600/30'}`}>{key}</span>
                      <span className={`grow leading-relaxed ${isCorrect ? 'text-green-400' : 'text-green-100'}`}>
                        <ExplanationRenderer text={val} />
                      </span>
                      {isCorrect && <CheckCircle2 size={18} className="text-white shrink-0 mt-0.5" />}
                    </div>
                  );
                })}
              </div>
              {q.explanation && (
                <div className="p-6 bg-slate-900 border border-white/5 rounded-2xl text-quiz text-slate-400 text-left">
                  <span className="text-[9px] font-black text-emerald-500 block mb-1 uppercase tracking-widest">Logic Breakdown</span>
                  <ExplanationRenderer text={q.explanation} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnswersTab;
