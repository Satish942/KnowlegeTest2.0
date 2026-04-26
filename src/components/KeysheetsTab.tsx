import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Key } from 'lucide-react';

interface Question {
  id: string;
  question_text: string;
  options: Record<string, string>;
  correct_answers: string[];
  explanation?: string;
}

const KeysheetsTab: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    const { data } = await supabase.from('documents').select('*');
    if (data) setDocuments(data);
  };

  const loadKeysheet = async () => {
    if (!selectedDocId) return;
    setLoading(true);
    const { data } = await supabase.from('questions').select('*').eq('document_id', selectedDocId);
    if (data) setQuestions(data);
    setLoading(false);
  };

  const normalizeAnswers = (ans: any): string[] => {
    const text = Array.isArray(ans) ? ans.join(',') : String(ans || '');
    return (text.toUpperCase().match(/[A-Z0-9]+/g) || []).filter(m => m.length === 1).map(s => s.trim()).filter(Boolean).sort();
  };

  return (
    <div className="space-y-12 p-4 sm:p-0">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <Key size={24} className="text-emerald-500" />
          <h3 className="text-2xl font-black text-white uppercase italic">Reference Registry</h3>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <select className="input-field mb-0 bg-slate-900 border-white/10 flex-1 sm:w-64" value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)}>
            <option value="">Choose document...</option>
            {documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={loadKeysheet} disabled={!selectedDocId || loading} className="primary-btn bg-emerald-600">
            {loading ? "LOAD..." : "LOAD KEY"}
          </button>
        </div>
      </div>

      <div className="space-y-12 pb-40">
        {questions.map((q, idx) => {
          const nC = normalizeAnswers(q.correct_answers);
          return (
            <div key={q.id} className="space-y-4">
              <div className="w-full p-8 bg-emerald-600/10 border border-emerald-500/20 text-white rounded-2xl font-bold text-quiz shadow-md">
                <span className="block text-[10px] font-black uppercase tracking-widest mb-3 text-emerald-500/60">REFERENCE NODE {idx + 1}</span>
                {q.question_text}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(q.options).map(([key, val]) => {
                  const isCorrect = nC.includes(key);
                  return (
                    <div key={key} className={`p-5 rounded-2xl border font-bold text-quiz flex items-start gap-4 transition-all ${
                      isCorrect ? 'bg-emerald-500/5 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/5' : 'bg-white/5 border-white/5 text-slate-500 opacity-40'
                    }`}>
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] shrink-0 font-black border ${isCorrect ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-black/20 text-slate-600 border-white/5'}`}>{key}</span>
                      <span className={`grow leading-relaxed font-black ${isCorrect ? 'text-emerald-400' : ''}`}>{val}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KeysheetsTab;
