import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, CheckCircle2, AlertCircle } from 'lucide-react';
import ExplanationRenderer from './ExplanationRenderer';

interface Question {
  id: string;
  question_text: string;
  options: Record<string, string>;
  correct_answers: string[];
  is_multi: boolean;
  max_selections?: number;
  explanation?: string;
}

const ExamTab: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [selectedDocName, setSelectedDocName] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string[]>>({});
  const [examState, setExamState] = useState<'idle' | 'running' | 'finished'>('idle');
  const [score, setScore] = useState(0);
  const [numToTake, setNumToTake] = useState<number>(0);
  const [totalAvailable, setTotalAvailable] = useState(0);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    const { data } = await supabase.from('documents').select('*, questions(count)') as any;
    if (data) setDocuments(data);
  };

  const startExam = async () => {
    if (!selectedDocId) return;
    const { data } = await supabase.from('questions').select('*').eq('document_id', selectedDocId);
    if (data && data.length > 0) {
      const selected = [...data].sort(() => Math.random() - 0.5).slice(0, numToTake || data.length);
      setQuestions(selected);
      setUserAnswers({});
      setExamState('running');
    }
  };

  const toggleOption = (q: Question, option: string) => {
    setUserAnswers(prev => {
      const current = prev[q.id] || [];
      if (q.is_multi) {
        if (current.includes(option)) return { ...prev, [q.id]: current.filter(o => o !== option) };
        if (current.length >= (q.max_selections || 1) && (q.max_selections || 1) > 1) return prev;
        return { ...prev, [q.id]: [...current, option] };
      }
      return { ...prev, [q.id]: [option] };
    });
  };

  const normalizeAnswers = (ans: any): string[] => {
    const text = Array.isArray(ans) ? ans.join(',') : String(ans || '');
    return (text.toUpperCase().match(/[A-Z0-9]+/g) || []).filter(m => m.length === 1).map(s => s.trim()).filter(Boolean).sort();
  };

  const submitExam = async () => {
    let finalScore = 0;
    questions.forEach(q => {
      const nU = normalizeAnswers(userAnswers[q.id] || []);
      const nC = normalizeAnswers(q.correct_answers);
      if (nU.length === nC.length && nU.every((v, i) => v === nC[i])) finalScore++;
    });
    setScore(finalScore);
    setExamState('finished');
    const attempted = Object.keys(userAnswers).filter(id => (userAnswers[id]?.length || 0) > 0).length;
    await supabase.from('exam_history').insert([{
      document_name: selectedDocName, score: finalScore, total_questions: questions.length,
      attempted_count: attempted, wrong_count: attempted - finalScore,
      user_responses: userAnswers, questions_snapshot: questions
    }]);
  };

  return (
    <div className="animate-fade-in px-2 sm:px-0">
      {examState === 'idle' && (
        <div className="flex flex-col items-center py-20 space-y-8 max-w-xl mx-auto">
          <Trophy size={80} className="text-indigo-400/40" />
          <h2 className="text-3xl font-black text-white uppercase italic">Assessment Initialization</h2>
          <div className="w-full space-y-4 glass-card p-8 border-white/10">
            <select className="input-field mb-0" value={selectedDocId} onChange={(e) => {
              const id = e.target.value; setSelectedDocId(id);
              const doc = documents.find(d => d.id === id); 
              setSelectedDocName(doc?.name || '');
              const count = doc?.questions[0]?.count || 0;
              setTotalAvailable(count); setNumToTake(count);
            }}>
              <option value="">Choose evaluation source...</option>
              {documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {selectedDocId && (
              <div className="flex items-center gap-4">
                <input type="number" min="1" max={totalAvailable} value={numToTake} onChange={(e) => setNumToTake(parseInt(e.target.value) || 0)} className="input-field mb-0 flex-1" />
                <span className="text-[10px] font-black text-muted uppercase">Limit</span>
              </div>
            )}
            <button disabled={!selectedDocId} onClick={startExam} className="primary-btn w-full bg-[#008CBA] hover:bg-[#007ba1]">INITIALIZE Assessment</button>
          </div>
        </div>
      )}

      {examState === 'running' && (
        <div className="space-y-12 max-w-5xl mx-auto py-8">
          <div className="sticky top-6 z-30 glass-card p-6 flex justify-between items-center bg-slate-900 shadow-2xl border-white/10">
            <h3 className="font-bold text-white uppercase text-sm tracking-widest truncate max-w-xs">{selectedDocName}</h3>
            <div className="flex items-center gap-6">
              <span className="text-xl font-black text-white">{Object.keys(userAnswers).length} / {questions.length}</span>
              <button onClick={submitExam} className="primary-btn bg-[#008CBA]">SUBMIT</button>
            </div>
          </div>

          <div className="space-y-12">
            {questions.map((q, idx) => (
              <div key={q.id} className="space-y-4">
                <div className="w-full p-8 bg-[#008CBA]/20 border border-[#008CBA]/30 text-white rounded-2xl shadow-md text-left font-question">
                   <span className="block text-[10px] font-black uppercase tracking-widest mb-3 opacity-60 font-option">QUESTION {idx + 1}</span>
                   <ExplanationRenderer text={q.question_text} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(q.options).map(([key, val]) => {
                    const isSelected = (userAnswers[q.id] || []).includes(key);
                    return (
                      <div key={key} onClick={() => toggleOption(q, key)}
                        className={`p-5 rounded-2xl transition-all text-left font-option flex items-start gap-4 cursor-pointer ${isSelected ? 'exam-option-selected' : 'exam-option'}`}
                      >
                        <span className={`w-6 h-6 rounded flex items-center justify-center font-black text-[10px] shrink-0 ${isSelected ? 'bg-white text-[#008CBA]' : 'bg-[#008CBA]/20 text-[#008CBA]'}`}>{key}</span>
                        <span className="grow"><ExplanationRenderer text={val} /></span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {examState === 'finished' && (
        <div className="space-y-16 py-12 max-w-5xl mx-auto">
          <div className="text-center p-12 glass-card bg-slate-900 border-white/5">
            <h2 className="text-4xl font-black text-white italic mb-8">FINAL SCORE: {score} / {questions.length}</h2>
            <button onClick={() => setExamState('idle')} className="primary-btn bg-[#008CBA]">NEW ATTEMPT</button>
          </div>

          <div className="space-y-16 pb-40">
            {questions.map((q, idx) => {
              const uA = userAnswers[q.id] || [];
              const nU = normalizeAnswers(uA); const nC = normalizeAnswers(q.correct_answers);
              const isCorrect = nU.length === nC.length && nU.every((v, i) => v === nC[i]);
              return (
                <div key={q.id} className="space-y-4">
                  <div className={`w-full p-8 rounded-2xl font-question text-left shadow-xl ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                    <span className="block text-[10px] font-black uppercase tracking-widest mb-2 opacity-70 font-option">QUESTION {idx + 1}</span>
                    <ExplanationRenderer text={q.question_text} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(q.options).map(([key, val]) => {
                      const isU = uA.includes(key); const isC = nC.includes(key);
                      let cls = 'bg-[#008CBA]/5 border-white/5 text-green-100 opacity-40';
                      if (isC) cls = 'bg-emerald-600 border-white/30 text-green-400 shadow-lg opacity-100';
                      else if (isU && !isC) cls = 'bg-rose-600 border-white/30 text-green-100 shadow-lg opacity-100';
                      return (
                        <div key={key} className={`p-5 rounded-2xl border font-option text-left flex items-start gap-4 ${cls}`}>
                          <span className="w-6 h-6 rounded bg-black/20 flex items-center justify-center text-[10px] shrink-0">{key}</span>
                          <span className="grow"><ExplanationRenderer text={val} /></span>
                          {isC && <CheckCircle2 size={18} />} {isU && !isC && <AlertCircle size={18} />}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && (
                    <div className="p-6 bg-slate-900 border border-white/5 rounded-2xl text-quiz text-slate-400 text-left">
                      <span className="text-[9px] font-black text-indigo-400 block mb-1 uppercase tracking-widest">Explanation</span>
                      <ExplanationRenderer text={q.explanation} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamTab;
