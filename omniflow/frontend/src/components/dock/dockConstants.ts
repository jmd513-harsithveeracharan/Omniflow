export interface DockModel {
  id: string;
  name: string;
  desc: string;
  tag: string;
}

export const ALL_MODELS: DockModel[] = [
  { id: 'tenali-ai', name: 'Tenali AI', desc: 'OmniFlow GPT-6 Luna • Multi-Agent Core Engine (Default)', tag: 'Active' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', desc: 'Most efficient for everyday tasks', tag: '' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: '1M+ context window for complex DAGs', tag: 'Pro' },
  { id: 'groq-120b', name: 'Groq 120B', desc: '70B parameter open weights with deep reasoning', tag: 'Pro' },
  { id: 'groq-20b', name: 'Groq 20B', desc: 'Ultra-low latency instant open weights', tag: '' },
  { id: 'claude-mix', name: 'Claude Mix', desc: 'Dynamic router: Opus for PySpark/AST + Sonnet for speed', tag: 'Mix' },
  { id: 'claude-opus-5', name: 'Claude Opus', desc: 'Deep reasoning & complex SQL AST transpilation', tag: 'Pro' },
  { id: 'claude-3-5-sonnet', name: 'Claude Sonnet', desc: 'High-precision schema mapping & PySpark', tag: '' },
  { id: 'claude-3-5-haiku', name: 'Claude Haiku', desc: 'Ultra-fast metadata discovery & intent', tag: '' },
  { id: 'gpt-4o', name: 'GPT-4o', desc: 'Advanced reasoning & SQL AST transpilation', tag: 'Pro' },
];
