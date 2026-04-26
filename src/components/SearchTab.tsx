import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, CheckCircle2 } from 'lucide-react';
import ExplanationRenderer from './ExplanationRenderer';

interface Question {
  id: string;
  question_text: string;
  options: Record<string, string>;
  correct_answers: string[];
  explanation?: string;
  document_id: string;
}

interface Document {
  id: string;
  name: string;
  created_at: string;
}

const SEARCH_FIELDS = [
  { id: 'question',    label: 'Question' },
  { id: 'options',     label: 'Options' },
  { id: 'answers',     label: 'Correct Answers' },
  { id: 'explanation', label: 'Explanation' },
];

const SearchTab: React.FC = () => {
  const [documents, setDocuments]     = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [query, setQuery]             = useState('');
  const [searchIn, setSearchIn]       = useState<string[]>(['question', 'options', 'explanation']);
  const [results, setResults]         = useState<Question[]>([]);
  const [loading, setLoading]         = useState(false);
  const [searched, setSearched]       = useState(false);

  const fetchDocuments = async () => {
    const { data } = await supabase.from('documents').select('*');
    if (data) setDocuments(data);
  };

  useEffect(() => { fetchDocuments(); }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);

    let q = supabase.from('questions').select('*');
    if (selectedDocId) q = q.eq('document_id', selectedDocId);
    const { data } = await q;
    const all: Question[] = data || [];

    const lower = query.toLowerCase();
    const filtered = all.filter(q => {
      if (searchIn.includes('question') && q.question_text?.toLowerCase().includes(lower)) return true;
      if (searchIn.includes('options')  && Object.values(q.options || {}).some(v => String(v).toLowerCase().includes(lower))) return true;
      if (searchIn.includes('explanation') && q.explanation?.toLowerCase().includes(lower)) return true;
      if (searchIn.includes('answers')  && (Array.isArray(q.correct_answers) ? q.correct_answers : []).some(a => String(a).toLowerCase().includes(lower))) return true;
      return false;
    });

    setResults(filtered);
    setLoading(false);
  };


  const normalizeAnswers = (ans: string | string[]): string[] => {
    const text = Array.isArray(ans) ? ans.join(',') : String(ans || '');
    return ((text.toUpperCase().match(/[A-Z0-9]+/g) || []) as string[]).filter(m => m.length === 1).sort();
  };

  const toggleField = (field: string) => {
    setSearchIn(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  return (
    <div className="space-y-8 animate-fade-in p-4 sm:p-0">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="search-tab-icon">
          <Search size={24} />
        </div>
        <h3 className="text-2xl font-black text-white uppercase italic">Search Documents</h3>
      </div>

      {/* Controls */}
      <div className="glass-card p-6">
        <select
          className="input-field"
          value={selectedDocId}
          onChange={(e) => setSelectedDocId(e.target.value)}
        >
          <option value="">All Documents</option>
          {documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        <div className="search-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="input-field mb-0 search-input"
            placeholder="Enter keyword to search..."
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            className="primary-btn"
            style={{ width: '120px', flexShrink: 0 }}
          >
            {loading ? 'SEARCHING…' : 'SEARCH'}
          </button>
        </div>

        {/* Search-in checkboxes */}
        <div className="search-filters">
          {SEARCH_FIELDS.map(f => (
            <label key={f.id} className="search-filter-item">
              <input
                type="checkbox"
                checked={searchIn.includes(f.id)}
                onChange={() => toggleField(f.id)}
                style={{ accentColor: '#6366f1', width: '15px', height: '15px' }}
              />
              <span className="search-filter-label">{f.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Results */}
      {searched && !loading && (
        <div>
          <p className="search-result-count">
            {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
          </p>

          {results.length === 0 ? (
            <div className="glass-card p-12 text-center" style={{ opacity: 0.5 }}>
              <Search size={40} style={{ color: '#475569', margin: '0 auto 16px' }} />
              <p style={{ color: '#475569', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                No matches found
              </p>
            </div>
          ) : (
            <div className="space-y-12 pb-20">
              {results.map((q, idx) => {
                const nC = normalizeAnswers(q.correct_answers);
                return (
                  <div key={q.id} className="space-y-4">

                    {/* Question block */}
                    <div className="search-question-block text-left font-question">
                      <span className="search-result-label font-option">RESULT #{idx + 1}</span>
                      <ExplanationRenderer text={q.question_text} searchTerm={query} />
                    </div>

                    {/* Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(q.options || {}).map(([key, val]) => {
                        const isCorrect = nC.includes(key);
                        return (
                          <div
                            key={key}
                            className={`search-option font-option ${isCorrect ? 'search-option-correct' : 'search-option-neutral'}`}
                          >
                            <span className={`search-option-key ${isCorrect ? 'search-option-key-correct' : 'search-option-key-neutral'}`}>
                              {key}
                            </span>
                            <span style={{ flex: 1 }}><ExplanationRenderer text={String(val)} searchTerm={query} /></span>
                            {isCorrect && <CheckCircle2 size={16} color="#4ade80" style={{ flexShrink: 0 }} />}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="search-explanation text-left">
                        <span className="search-explanation-label">Explanation</span>
                        <ExplanationRenderer text={q.explanation} searchTerm={query} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchTab;
