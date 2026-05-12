import React, { useState, useEffect } from 'react';
import { Upload as UploadIcon, Trash2, Loader2, FileCode, CheckCircle2, AlertCircle, Database, Settings2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { extractTextFromPDF, extractTextFromDocx, parseExamText } from '../utils/parser';
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
    <div className="space-y-12 animate-fade-in p-4 sm:p-0">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="config-panel">
            <div className="flex items-center gap-3 mb-8">
              <Settings2 size={24} className="text-indigo-400" />
              <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Parser Params</h3>
            </div>

            <div className="space-y-5">
              <div>
                <label className="config-label">Question String</label>
                <input
                  list="questions-list"
                  type="text"
                  value={config.questionMarker}
                  onChange={(e) => setConfig({...config, questionMarker: e.target.value})}
                  className="input-field mb-0"
                  placeholder="e.g. n. or Q"
                />
                <datalist id="questions-list">
                  {presets.questions.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div>
                <label className="config-label">Option String Starts</label>
                <input
                  list="options-list"
                  type="text"
                  value={config.optionMarker}
                  onChange={(e) => setConfig({...config, optionMarker: e.target.value})}
                  className="input-field mb-0"
                  placeholder="e.g. A: or n:"
                />
                <datalist id="options-list">
                  {presets.options.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div>
                <label className="config-label">Answer Start String</label>
                <input
                  list="answers-list"
                  type="text"
                  value={config.answerStartMarker}
                  onChange={(e) => setConfig({...config, answerStartMarker: e.target.value})}
                  className="input-field mb-0"
                  placeholder="e.g. Answer: or Correct:"
                />
                <datalist id="answers-list">
                  {presets.answers.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div>
                <label className="config-label">Explanation</label>
                <input
                  list="explanations-list"
                  type="text"
                  value={config.explanationMarker}
                  onChange={(e) => setConfig({...config, explanationMarker: e.target.value})}
                  className="input-field mb-0"
                  placeholder="e.g. Explanation:"
                />
                <datalist id="explanations-list">
                  {presets.explanations.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div>
                <label className="config-label">Reference URL</label>
                <input
                  list="references-list"
                  type="text"
                  value={config.referenceUrlMarker}
                  onChange={(e) => setConfig({...config, referenceUrlMarker: e.target.value})}
                  className="input-field mb-0"
                  placeholder="e.g. Reference:"
                />
                <datalist id="references-list">
                  {presets.references.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>

              <label className="config-checkbox-row">
                <input
                  type="checkbox"
                  checked={config.pickReferenceUrl}
                  onChange={(e) => setConfig({...config, pickReferenceUrl: e.target.checked})}
                />
                <span className="config-checkbox-label">Pick Reference URLs</span>
              </label>

              <label className="config-checkbox-row">
                <input
                  type="checkbox"
                  checked={config.haveChapters}
                  onChange={(e) => setConfig({...config, haveChapters: e.target.checked})}
                />
                <span className="config-checkbox-label">Have Chapters</span>
              </label>

              <label className="config-checkbox-row">
                <input
                  type="checkbox"
                  checked={config.extractImages}
                  onChange={(e) => setConfig({...config, extractImages: e.target.checked})}
                />
                <span className="config-checkbox-label">Extract Images (Slower)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Drop Zone */}
        <div className="lg:col-span-2">
          <div 
            onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
            className={`relative flex flex-col items-center justify-center h-full p-16 rounded-[3rem] transition-all duration-500 ${dragActive ? 'dropzone-active' : 'dropzone-inactive'}`}
          >
            <div className={`p-8 rounded-3xl mb-8 group transition-all duration-500 ${dragActive ? 'bg-indigo-500 shadow-2xl shadow-indigo-500/40' : 'bg-slate-900 border border-white/5'}`}>
              <UploadIcon size={64} className={`${dragActive ? 'text-white' : 'text-indigo-400'} group-hover:scale-110 transition-transform`} />
            </div>
            <div className="text-center space-y-4 max-w-md">
              <h3 className="text-3xl font-black text-white italic">{file ? file.name : 'Ingestion Ingest Protocol'}</h3>
              <p className="text-muted text-sm font-medium leading-relaxed">
                {file ? "Assessment source locked. Begin extraction cycle." : "Drop your PDF or DOCX assessment materials here or click to initialize manual selection."}
              </p>
            </div>
            
            <div className="mt-12 flex flex-col items-center gap-6 w-full max-w-xs">
              <input type="file" id="file-upload" className="hidden" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {!file ? (
                <label htmlFor="file-upload" className="primary-btn w-full text-center py-4 cursor-pointer">SELECT ASSESSMENT</label>
              ) : (
                <button onClick={handleUpload} disabled={loading} className="secondary-btn w-full py-4 bg-indigo-600 text-white uppercase font-black tracking-widest shadow-xl shadow-indigo-500/20">
                  {loading ? <Loader2 className="animate-spin" size={24} /> : "EXECUTE INGESTION"}
                </button>
              )}
              {status && (
                <div className={`flex items-center gap-3 text-xs font-black uppercase tracking-widest pt-4 ${status.includes('Error') ? 'text-rose-400' : 'text-indigo-400 animate-pulse'}`}>
                  {status.includes('successfully') ? <CheckCircle2 size={18} /> : status.includes('Error') ? <AlertCircle size={18} /> : <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />}
                  {status}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8 pt-12">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
              <Database size={24} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">Active Knowledge Base</h3>
              <p className="text-[10px] font-black text-muted tracking-widest uppercase">{documents.length} Matrices Archived</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => (
            <motion.div layout key={doc.id} className="p-6 bg-slate-900/60 border border-white/5 rounded-3xl flex justify-between items-center group hover:border-indigo-500/30 transition-all duration-300">
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center">
                  <FileCode size={22} className="text-indigo-400/60" />
                </div>
                <div className="overflow-hidden">
                  <p className="font-bold text-white truncate max-w-[140px] tracking-tight">{doc.name}</p>
                  <p className="text-[10px] font-black text-muted uppercase tracking-widest">{doc.count} Clusters</p>
                </div>
              </div>
              <button onClick={(e) => deleteDocument(doc.id, e)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-xl transition-all border border-transparent">
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UploadTab;
