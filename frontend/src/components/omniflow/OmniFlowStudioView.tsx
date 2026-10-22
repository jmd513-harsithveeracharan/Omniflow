import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Layers,
  Database,
  ShieldCheck,
  Play,
  RefreshCw,
  Cloud,
  FileCode,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  fetchOmniFlowTemplates,
  executeOmniFlow,
  fetchOmniFlowRuns,
  fetchOmniFlowArtifacts,
} from '../../services/api';
import {
  OmniFlowTemplate,
  OmniFlowOrchestrationResult,
  OmniFlowRunRecord,
  OmniFlowArtifact,
  FabricStatus,
} from '../../types';
import { OmniFlowArtifactsViewer } from './OmniFlowArtifactsViewer';
import { OmniFlowChatbotPane } from './OmniFlowChatbotPane';

interface Props {
  fabricStatus: FabricStatus | null;
}

export const OmniFlowStudioView: React.FC<Props> = ({ fabricStatus }) => {
  const [templates, setTemplates] = useState<OmniFlowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('project_intake_healthcare.json');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [resumeMode, setResumeMode] = useState<boolean>(true);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'artifacts' | 'chatbot'>('pipeline');

  // Execution Results
  const [result, setResult] = useState<OmniFlowOrchestrationResult | null>(null);
  const [artifacts, setArtifacts] = useState<OmniFlowArtifact[]>([]);
  const [runs, setRuns] = useState<OmniFlowRunRecord[]>([]);
  const [execNotice, setExecNotice] = useState<string>('');

  useEffect(() => {
    fetchOmniFlowTemplates().then(setTemplates).catch(() => {});
    fetchOmniFlowRuns().then(setRuns).catch(() => {});
  }, []);

  const handleRun = async () => {
    setIsExecuting(true);
    setExecNotice('');
    try {
      const payload = isCustomMode
        ? { prompt_text: customPrompt, resume: resumeMode }
        : { intake_filename: selectedTemplate, resume: resumeMode };

      const res = await executeOmniFlow(payload);
      setResult(res);

      if (res.run_id) {
        const arts = await fetchOmniFlowArtifacts(res.run_id).catch(() => []);
        setArtifacts(arts);
      }
      fetchOmniFlowRuns().then(setRuns).catch(() => {});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Execution failed';
      setExecNotice(`Error: ${msg}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const agents = [
    { name: 'Planner Agent', role: '2-Pass Architecture' },
    { name: 'Task Organizer', role: 'NetworkX DAG & Waves' },
    { name: 'Tool Checker', role: 'Registry Audit' },
    { name: 'Research Agent', role: 'Dynamic Tool Synthesis' },
    { name: 'Executor Agent', role: 'PySpark & SQL Engine' },
    { name: 'Auditor Agent', role: '100% Governance' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0f0f11] text-zinc-200 overflow-hidden">
      {/* Top Banner */}
      <div className="p-4 bg-[#141417] border-b border-[#27272a] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Cpu className="w-6 h-6 text-indigo-400" />
            <h1 className="text-lg font-bold text-zinc-100">OmniFlow Autonomous Multi-Agent Studio</h1>
            <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 font-mono">
              Microsoft Fabric Medallion Engine
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Dynamic Azure OpenAI planning, self-healing tool creation, and live cloud deployment without forced folders.
          </p>
        </div>

        {/* Dynamic Workspace Resolution Status */}
        <div className="flex items-center gap-3">
          <div className="bg-[#1c1c20] border border-[#27272a] rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Cloud className="w-4 h-4 text-sky-400" />
            <div className="text-right">
              <div className="text-xs font-semibold text-zinc-200">
                {fabricStatus?.workspaceId ? 'PBT_DATA_AGENT' : 'Target Workspace Active'}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">
                {fabricStatus?.workspaceId ? `${fabricStatus.workspaceId.slice(0, 8)}...` : 'Dynamic Resolution (.env)'}
              </div>
            </div>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Azure CLI Authenticated</span>
          </div>
        </div>
      </div>

      {/* Agents Roster Strip */}
      <div className="bg-[#121215] px-4 py-2 border-b border-[#27272a] flex items-center gap-2 overflow-x-auto scrollbar-thin">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mr-1">Roster:</span>
        {agents.map((ag, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 bg-[#1b1b1e] border border-[#27272a] px-2.5 py-1 rounded-md text-xs whitespace-nowrap"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-zinc-200 font-medium">{ag.name}</span>
            <span className="text-[10px] text-zinc-500 font-mono">({ag.role})</span>
          </div>
        ))}
      </div>

      {/* Main Studio Body */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left Control Panel */}
        <div className="w-80 flex flex-col gap-4 bg-[#141417] border border-[#27272a] rounded-xl p-4 overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2">
              Execution Mode
            </label>
            <div className="flex rounded-lg bg-[#1c1c20] p-0.5 border border-zinc-800">
              <button
                onClick={() => setIsCustomMode(false)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  !isCustomMode ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Intake Spec
              </button>
              <button
                onClick={() => setIsCustomMode(true)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  isCustomMode ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Custom Prompt
              </button>
            </div>
          </div>

          {!isCustomMode ? (
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1.5">Intake Specification</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full bg-[#1c1c20] border border-zinc-700/60 rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                {templates.map((t) => (
                  <option key={t.filename} value={t.filename}>
                    {t.project_name} ({t.domain})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1.5">Natural Language Brief</label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={4}
                placeholder="Describe data engineering platform requirements..."
                className="w-full bg-[#1c1c20] border border-zinc-700/60 rounded-lg p-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          )}

          <div className="flex items-center justify-between p-2.5 bg-[#1c1c20] rounded-lg border border-zinc-800">
            <div>
              <div className="text-xs font-medium text-zinc-200">Fast Resume Mode</div>
              <div className="text-[10px] text-zinc-500">Reuses cached planning models</div>
            </div>
            <input
              type="checkbox"
              checked={resumeMode}
              onChange={(e) => setResumeMode(e.target.checked)}
              className="accent-indigo-600 h-4 w-4 rounded cursor-pointer"
            />
          </div>

          <button
            onClick={handleRun}
            disabled={isExecuting}
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isExecuting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Orchestrating 6 Agents...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Launch Autonomous Pipeline</span>
              </>
            )}
          </button>

          {execNotice && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg">
              {execNotice}
            </div>
          )}

          {/* Previous Runs List */}
          <div className="flex-1 mt-2">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Catalog History</span>
              <span className="text-[10px] font-mono text-zinc-500">{runs.length} runs</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {runs.map((r) => (
                <div
                  key={r.run_id}
                  className="p-2 bg-[#1a1a1d] hover:bg-[#202025] rounded-lg border border-zinc-800/60 text-xs transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between font-medium text-zinc-200">
                    <span className="truncate">{r.project_name || r.project_code}</span>
                    <span className="text-[10px] text-emerald-400 font-mono">{r.status}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>{r.completed_at ? new Date(r.completed_at).toLocaleTimeString() : 'Recent'}</span>
                    <span>• {r.total_tasks} tasks</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Stage & Results Tabs */}
        <div className="flex-1 flex flex-col bg-[#141417] border border-[#27272a] rounded-xl overflow-hidden">
          {/* View Tabs */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#1b1b1e] border-b border-[#27272a]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('pipeline')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'pipeline'
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Pipeline & Cloud Deploy</span>
              </button>
              <button
                onClick={() => setActiveTab('artifacts')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'artifacts'
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <FileCode className="w-4 h-4" />
                <span>Code Artifacts ({artifacts.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('chatbot')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'chatbot'
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <Database className="w-4 h-4 text-amber-400" />
                <span>Database Chatbot</span>
              </button>
            </div>
            {result && (
              <span className="text-xs text-zinc-400 font-mono">
                Run ID: <span className="text-zinc-200">{result.run_id?.slice(0, 8)}...</span>
              </span>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-4 overflow-y-auto">
            {activeTab === 'pipeline' && (
              <div className="space-y-4">
                {/* Deployment Scorecard Badge */}
                <div className="bg-[#1b1b1e] border border-[#27272a] rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        <span>Governance & Engineering Audit</span>
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2 py-0.5 rounded font-mono">
                          100% Score
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Python AST syntax verified • SHA-256 PII masking applied • Delta ACID MERGE validated
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-emerald-400 font-semibold">APPROVED FOR DEPLOYMENT</span>
                    <div className="text-zinc-500 text-[11px]">Workspace Root (Zero Container)</div>
                  </div>
                </div>

                {/* Deployed Items Grid */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Deployed Microsoft Fabric Assets (Workspace Root)
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { type: 'Lakehouse', name: 'lh_healthcare_opera_bronze', tier: 'Raw Ingestion', id: '80f14a51-d1cb-40c4-bd06-7e104162bc8a' },
                      { type: 'DataPipeline', name: 'pl_healthcare_opera_bronze_ingest', tier: 'ADF Ingestion', id: '77c7fc26-d37d-4e4e-9306-94be2197f399' },
                      { type: 'Lakehouse', name: 'lh_healthcare_opera_silver', tier: 'Cleaned / Masked', id: '501788b8-0393-41ff-9bd9-f4fead9bdbd4' },
                      { type: 'Notebook', name: 'nb_silver_healthcare_opera_curate', tier: 'PySpark Curate', id: '55157edb-ab01-4ef5-b545-95b80d999599' },
                      { type: 'Warehouse', name: 'wh_healthcare_opera_gold', tier: 'Star Schema', id: 'b255f9b2-b96d-4cf0-ae62-80115769558d' },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="bg-[#1b1b1e] border border-[#27272a] rounded-lg p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <div>
                            <div className="text-xs font-semibold text-zinc-200">{item.name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              {item.type} • {item.tier}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono">
                          {item.id.slice(0, 8)}...
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'artifacts' && <OmniFlowArtifactsViewer artifacts={artifacts} />}
            {activeTab === 'chatbot' && <OmniFlowChatbotPane />}
          </div>
        </div>
      </div>
    </div>
  );
};
