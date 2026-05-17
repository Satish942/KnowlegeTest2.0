import React, { useState, useEffect } from 'react';
import { Upload as UploadIcon, Trash2, Loader2, Database, Settings2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { extractTextFromPDF, extractTextFromDocx, extractTextFromTxt, parseExamText } from '../utils/parser';
import type { ParserConfig } from '../utils/parser';
import { motion } from 'framer-motion';

interface Document {
  id: string;
  name: string;
  created_at: string;
  questions?: { count: number }[];
  count?: number;
}

const UploadTab: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [status, setStatus] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Parser Configuration State
  const [config, setConfig] = useState<ParserConfig>({
    questionMarker: '',
    optionMarker: '',
    answerStartMarker: '',
    explanationMarker: '',
    referenceUrlMarker: '',
    pickReferenceUrl: false,
    haveChapters: false,
    extractImages: false
  });

  const [presets, setPresets] = useState({
    questions: ['n.', 'Q', 'Qn.'],
    options: ['A:', 'n:', 'A.'],
    answers: ['Answer:', 'Correct:', 'Key:'],
    explanations: ['Explanation:', 'Rationale:'],
    references: ['Reference:', 'URL:']
  });

  const fetchPresets = async () => {
    const { data } = await supabase.from('parser_presets').select('*').order('created_at', { ascending: false }).limit(50);
    if (data && data.length > 0) {
      // Use the most recent as current config
      const latest = data[0];
      setConfig(prev => ({
        ...prev,
        questionMarker: latest.question_marker || prev.questionMarker,
        optionMarker: latest.option_marker || prev.optionMarker,
        answerStartMarker: latest.answer_marker || prev.answerStartMarker,
        explanationMarker: latest.explanation_marker || prev.explanationMarker,
        referenceUrlMarker: latest.reference_marker || prev.referenceUrlMarker,
      }));

      const p = {
        questions: [...new Set(['n.', 'Q', 'Qn.', ...data.map(d => d.question_marker).filter(Boolean)])],
        options: [...new Set(['A:', 'n:', 'A.', ...data.map(d => d.option_marker).filter(Boolean)])],
        answers: [...new Set(['Answer:', 'Correct:', 'Key.', ...data.map(d => d.answer_marker).filter(Boolean)])],
        explanations: [...new Set(['Explanation:', 'Rationale:', ...data.map(d => d.explanation_marker).filter(Boolean)])],
        references: [...new Set(['Reference:', 'URL:', ...data.map(d => d.reference_marker).filter(Boolean)])],
      };
      setPresets(p);
    }
  };

  const fetchDocuments = async () => {
    const { data, error } = await supabase.from('documents').select('*, questions(count)') as { data: Document[] | null, error: any };
    if (error) console.error(error);
    else {
      const docs = (data || []).map((d: Document) => ({
        ...d,
        count: d.questions?.[0]?.count || 0
      }));
      setDocuments(docs);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchPresets();
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setStatus('Extracting assessment signals...');
    
    try {
      let text = '';
      const updateProgress = (curr: number, total: number) => {
        setStatus(`Extracting assessment signals... [Node ${curr}/${total}]`);
      };

      if (file.name.endsWith('.pdf')) {
        text = await extractTextFromPDF(file, config, updateProgress);
      } else if (file.name.endsWith('.docx')) {
        text = await extractTextFromDocx(file, updateProgress);
      } else if (file.name.endsWith('.txt')) {
        text = await extractTextFromTxt(file);
      } else {
        throw new Error('Unsupported format');
      }

      setStatus('Mapping parameterized structures...');
      const questions = parseExamText(text, config);

      if (questions.length === 0) {
        throw new Error('No valid nodes identified with current parameters');
      }

      setStatus(`Persisting ${questions.length} item matrix...`);
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert([{ name: file.name }])
        .select().single();

      if (docError) throw docError;

      const questionData = questions.map(q => ({
        question_text: q.question_text,
        options: q.options,
        correct_answers: q.correct_answers,
        is_multi: q.is_multi,
        explanation: q.explanation ?? null,
        document_id: doc.id,
      }));

      const { error: qError } = await supabase.from('questions').insert(questionData);
      if (qError) throw qError;

      setStatus('Ingestion synchronized successfully');
      
      // Save preset to DB
      await supabase.from('parser_presets').insert([{
        question_marker: config.questionMarker,
        option_marker: config.optionMarker,
        answer_marker: config.answerStartMarker,
        explanation_marker: config.explanationMarker,
        reference_marker: config.referenceUrlMarker
      }]);

      setFile(null);
      fetchDocuments();
      fetchPresets();
      setTimeout(() => setStatus(''), 5000);
    } catch (err: unknown) {
      const error = err as Error;
      console.error(error);
      const base = error.message || String(err);
      const hint =
        base === 'Failed to fetch' || base.includes('Load failed')
          ? ' (Supabase unreachable: verify .env URL/key, project not paused, VPN/firewall, then restart dev server.)'
          : '';
      setStatus(`Protocol Error: ${base}${hint}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Wipe this matrix?')) return;
    setLoading(true);
    try {
      await supabase.from('questions').delete().eq('document_id', id);
      await supabase.from('documents').delete().eq('id', id);
      fetchDocuments();
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="animate-fade-in p-4 sm:p-0">
      <div className="grid gap-8" style={{ gridTemplateColumns: '40fr 60fr' }}>
        {/* Configuration Panel */}
        <div className="space-y-6 h-full">
          <div className="config-panel bg-[#15192b] border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-8">
              <Settings2 size={24} className="text-white" />
              <h3 className="text-xl font-bold text-white tracking-tight">Parser Params</h3>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Question String</label>
                <input
                  list="questions-list"
                  type="text"
                  value={config.questionMarker}
                  onChange={(e) => setConfig({...config, questionMarker: e.target.value})}
                  className="w-full bg-[#0f121f] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="e.g. n. or Q"
                />
                <datalist id="questions-list">
                  {presets.questions.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Option String Starts</label>
                <input
                  list="options-list"
                  type="text"
                  value={config.optionMarker}
                  onChange={(e) => setConfig({...config, optionMarker: e.target.value})}
                  className="w-full bg-[#0f121f] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="e.g. A: or n:"
                />
                <datalist id="options-list">
                  {presets.options.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Answer Start String</label>
                <input
                  list="answers-list"
                  type="text"
                  value={config.answerStartMarker}
                  onChange={(e) => setConfig({...config, answerStartMarker: e.target.value})}
                  className="w-full bg-[#0f121f] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="e.g. Answer: or Correct:"
                />
                <datalist id="answers-list">
                  {presets.answers.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Explanation</label>
                <input
                  list="explanations-list"
                  type="text"
                  value={config.explanationMarker}
                  onChange={(e) => setConfig({...config, explanationMarker: e.target.value})}
                  className="w-full bg-[#0f121f] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="e.g. Explanation:"
                />
                <datalist id="explanations-list">
                  {presets.explanations.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Reference URL</label>
                <input
                  list="references-list"
                  type="text"
                  value={config.referenceUrlMarker}
                  onChange={(e) => setConfig({...config, referenceUrlMarker: e.target.value})}
                  className="w-full bg-[#0f121f] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="e.g. Reference:"
                />
                <datalist id="references-list">
                  {presets.references.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={config.pickReferenceUrl}
                  onChange={(e) => setConfig({...config, pickReferenceUrl: e.target.checked})}
                  className="w-5 h-5 rounded border-white/10 bg-[#0f121f] checked:bg-indigo-500 transition-colors"
                />
                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Pick Reference URLs</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={config.haveChapters}
                  onChange={(e) => setConfig({...config, haveChapters: e.target.checked})}
                  className="w-5 h-5 rounded border-white/10 bg-[#0f121f] checked:bg-indigo-500 transition-colors"
                />
                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Have Chapters</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={config.extractImages}
                  onChange={(e) => setConfig({...config, extractImages: e.target.checked})}
                  className="w-5 h-5 rounded border-white/10 bg-[#0f121f] checked:bg-indigo-500 transition-colors"
                />
                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Extract Images (Slower)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Side Stack */}
        <div className="flex flex-col gap-8">
          {/* Drop Zone */}
        <div>
          <div 
            onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
            className={`relative flex flex-col items-center h-full p-8 border-2 border-dashed border-slate-700/60 rounded-xl transition-all duration-300 ${dragActive ? 'bg-[#15192b]/50 border-indigo-500' : 'bg-transparent'}`}
          >
            <div className="w-32 h-32 flex items-center justify-center border border-white/5 bg-transparent mb-10">
              <UploadIcon size={56} className="text-white" strokeWidth={2} />
            </div>
            
            <div className="text-center w-full px-2 mb-8">
              <h3 className="text-2xl font-bold text-white mb-6 tracking-tight">{file ? file.name : 'Ingestion Ingest Protocol'}</h3>
              <p className="text-[#8ca1be] text-[15px] leading-relaxed">
                {file ? "Assessment source locked. Begin extraction cycle." : "Drop your PDF, DOCX or TXT assessment materials here or click to initialize manual selection."}
              </p>
            </div>
            
            <div className="w-full flex flex-col items-center gap-6 mt-auto">
              <input 
                 type="file" 
                 id="file-upload" 
                 className="text-white text-sm file:mr-3 file:py-1.5 file:px-3 file:border-0 file:text-sm file:bg-white file:text-black cursor-pointer" 
                 accept=".pdf,.docx,.txt" 
                 onChange={(e) => setFile(e.target.files?.[0] || null)} 
              />
              
              {!file ? (
                <label htmlFor="file-upload" className="w-full text-center py-3.5 bg-[#008cba] hover:bg-[#0079a1] transition-colors text-white font-bold rounded-lg cursor-pointer text-sm tracking-wide">
                  SELECT ASSESSMENT
                </label>
              ) : (
                <button onClick={handleUpload} disabled={loading} className="w-full py-3.5 bg-[#008cba] hover:bg-[#0079a1] transition-colors text-white font-bold rounded-lg shadow-lg text-sm tracking-wide">
                  {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : "EXECUTE INGESTION"}
                </button>
              )}
              
              {status && (
                <div className={`text-xs font-bold ${status.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {status}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Knowledge Base */}
        <div className="space-y-6">
          <div className="bg-[#15192b] border border-white/5 rounded-2xl p-6 shadow-xl h-full flex flex-col max-h-[800px]">
            <div className="flex gap-4 mb-8 items-start">
              <div className="mt-1 p-2 bg-white/5 rounded-lg border border-white/10">
                <Database size={24} className="text-slate-200" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white tracking-tight">Active Knowledge Base</h3>
                <p className="text-sm font-semibold text-slate-400 mt-1">{documents.length} Matrices Archived</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {documents.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-8 font-medium italic">No matrices archived yet.</div>
              ) : (
                documents.map((doc) => (
                  <motion.div layout key={doc.id} className="p-4 bg-[#0f121f] border border-white/5 rounded-xl flex justify-between items-center group hover:border-indigo-500/30 transition-all duration-300">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="overflow-hidden">
                        <p className="font-bold text-white text-sm truncate tracking-tight">{doc.name}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{doc.count} Clusters</p>
                      </div>
                    </div>
                    <button onClick={(e) => deleteDocument(doc.id, e)} className="w-8 h-8 shrink-0 flex items-center justify-center hover:bg-rose-500/20 text-slate-600 hover:text-rose-400 rounded-lg transition-all border border-transparent">
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default UploadTab;
