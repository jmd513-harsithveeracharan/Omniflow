import React, { useState, useEffect } from 'react';
import { X, BookOpen, Sparkles, Check, Copy, Code } from 'lucide-react';
import { fetchSkills, fetchSkillDetail } from '../services/api';
import { SkillSummary } from '../types';

interface SkillInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSkillPrompt?: (prompt: string) => void;
  skillName?: string;
}

export const SkillInspectorModal: React.FC<SkillInspectorModalProps> = ({
  isOpen,
  onClose,
  onSelectSkillPrompt,
  skillName,
}) => {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [selectedSkillName, setSelectedSkillName] = useState<string>(skillName || '');
  const [activeSkillDetail, setActiveSkillDetail] = useState<SkillSummary | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (skillName) {
      setSelectedSkillName(skillName);
    }
  }, [skillName]);

  useEffect(() => {
    if (isOpen) {
      fetchSkills()
        .then((data) => {
          setSkills(data);
          if (data.length > 0 && !selectedSkillName) {
            setSelectedSkillName(skillName || data[0].name);
          }
        })
        .catch(console.error);
    }
  }, [isOpen, skillName]);

  useEffect(() => {
    if (selectedSkillName) {
      setLoading(true);
      fetchSkillDetail(selectedSkillName)
        .then((detail) => {
          setActiveSkillDetail(detail);
          setLoading(false);
        })
        .catch((e) => {
          console.error(e);
          setLoading(false);
        });
    }
  }, [selectedSkillName]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!activeSkillDetail?.fullRunbook) return;
    navigator.clipboard.writeText(activeSkillDetail.fullRunbook);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'meta':
        return <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">Meta-Skill</span>;
      case 'governance':
        return <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">Governance</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] bg-brand-primary/20 text-brand-cyan border border-brand-primary/30">Engineering</span>;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[85vh] bg-[#0c1222] border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 px-6 border-b border-border/70 flex items-center justify-between bg-surface-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center text-brand-cyan">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Fabric Domain Skills Catalog</h2>
              <p className="text-[11px] text-slate-400">9 Specialized Autonomous AI Workflows & Knowledge Runbooks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-surface hover:bg-surface-hover text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body: Left sidebar (skill list) & Right view (runbook details) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Skill List */}
          <div className="w-80 border-r border-border/70 bg-surface/30 overflow-y-auto p-3 space-y-2 shrink-0">
            {skills.map((s) => {
              const isSelected = s.name === selectedSkillName;
              return (
                <button
                  key={s.name}
                  onClick={() => setSelectedSkillName(s.name)}
                  className={`w-full text-left p-3 rounded-xl transition-all border ${
                    isSelected
                      ? 'bg-brand-primary/20 border-brand-primary text-white shadow-md'
                      : 'bg-surface-card/60 border-border/40 text-slate-300 hover:bg-surface-hover hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-medium text-slate-200 truncate">
                      {s.displayName || s.name}
                    </span>
                    {getTierBadge(s.tier)}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {s.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Detailed Skill View */}
          <div className="flex-1 flex flex-col bg-[#080d1a] overflow-hidden">
            {loading ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                <Sparkles className="w-5 h-5 animate-spin text-brand-cyan mr-2" />
                Loading skill runbook...
              </div>
            ) : activeSkillDetail ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Detail Bar */}
                <div className="p-4 border-b border-border/60 bg-surface-card/40 flex items-center justify-between shrink-0">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-white">{activeSkillDetail.displayName}</h3>
                      {getTierBadge(activeSkillDetail.tier)}
                    </div>
                    <p className="text-xs text-slate-400">{activeSkillDetail.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover text-xs text-slate-200 border border-border flex items-center gap-1.5 transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      {copied ? 'Copied' : 'Copy Runbook'}
                    </button>
                    {onSelectSkillPrompt && (
                      <button
                        onClick={() => {
                          onSelectSkillPrompt(`Use the ${activeSkillDetail.name} skill to architect a solution.`);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-brand-primary hover:bg-indigo-500 text-xs text-white font-medium flex items-center gap-1.5 shadow-md shadow-brand-primary/20 transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Execute Skill
                      </button>
                    )}
                  </div>
                </div>

                {/* Markdown Runbook Viewer */}
                <div className="flex-1 overflow-y-auto p-6 font-mono text-xs text-slate-300 leading-relaxed space-y-4">
                  <div className="p-4 rounded-xl bg-surface-card/80 border border-border/80">
                    <div className="flex items-center gap-2 text-brand-cyan text-xs font-semibold mb-2">
                      <Code className="w-4 h-4" />
                      SKILL.MD Specification & Directives
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-300 overflow-x-auto">
                      {activeSkillDetail.fullRunbook || activeSkillDetail.description}
                    </pre>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
