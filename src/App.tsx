import React, { useState } from 'react';
import { Upload, FileText, History, CheckCircle2 } from 'lucide-react';
import UploadTab from './components/UploadTab';
import AnswersTab from './components/AnswersTab';
import ExamTab from './components/ExamTab';
import HistoryTab from './components/HistoryTab';
import DataStructureTab from './components/DataStructureTab';

import { Database } from 'lucide-react';

type TabType = 'upload' | 'answers' | 'exam' | 'history' | 'data';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('upload');

  const tabs = [
    { id: 'upload',  label: 'Upload',       icon: <Upload size={20} /> },
    { id: 'answers', label: 'Answers',      icon: <CheckCircle2 size={20} /> },
    { id: 'exam',    label: 'Exam',         icon: <FileText size={20} /> },
    { id: 'history', label: 'History',      icon: <History size={20} /> },
    { id: 'data',    label: 'Answers Data', icon: <Database size={20} /> },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 text-center pt-8">
          <h1 className="text-5xl font-black mb-3 bg-gradient-to-br from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent tracking-tight">
            AI Exam Engine
          </h1>
          <p className="text-muted text-lg font-medium max-w-2xl mx-auto">
            Transform your study materials into intelligent, interactive evaluation sets
          </p>
        </header>

        <div className="glass-card shadow-2xl border-white/5 overflow-hidden">
          <div className="flex border-b border-white/5 bg-slate-950/40 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`tab-btn flex items-center gap-2 ${activeTab === tab.id ? 'active' : ''}`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'upload' && <UploadTab />}
            {activeTab === 'answers' && <AnswersTab />}
            {activeTab === 'exam' && <ExamTab />}
            {activeTab === 'history' && <HistoryTab />}
            {activeTab === 'data' && <DataStructureTab />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
