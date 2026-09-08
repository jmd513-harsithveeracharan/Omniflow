import React, { useState, useEffect } from 'react';
import { Search, Eye, Play, Sparkles } from 'lucide-react';
import { fetchSkills } from '../services/api';
import { SkillSummary } from '../types';

interface SkillsViewProps {
  onSelectSkillPrompt: (prompt: string) => void;
  onInspectSkill: (skillName: string) => void;
}

export const SkillsView: React.FC<SkillsViewProps> = ({
  onSelectSkillPrompt,
  onInspectSkill,
}) => {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSkills()
      .then((data) => {
        setSkills(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load skills', err);
        setLoading(false);
      });
  }, []);

  const filteredSkills = skills.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.displayName.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (activeFilter === 'all') return true;
    if (activeFilter === 'workflow') return s.tier === 'workflow' || s.name.includes('medallion') || s.name.includes('ingestion');
    if (activeFilter === 'atomic') return s.tier === 'atomic' || (!s.name.includes('medallion') && !s.name.includes('using_'));
    if (activeFilter === 'pattern') return s.tier === 'pattern' || s.name.includes('governance') || s.name.includes('testing');
    return true;
  });

  return (
    <section className="view-panel active" id="viewSkills">
      <div className="skills-page-container">
        {/* Header with Title, Search, and Actions */}
        <div className="skills-page-header">
          <div className="pane-title-group">
            <h1 className="skills-page-title">Skills & Grounding Engine</h1>
            <span className="pane-subtitle-badge" id="skillsTotalCountBadge">
              {skills.length || 20} Skills Active
            </span>
          </div>
          <div className="skills-page-header-actions">
            <div className="skills-search-wrapper">
              <Search width={14} height={14} />
              <input
                type="text"
                id="inputSkillsSearch"
                placeholder="Search skills..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
            <button
              className="skills-btn-new"
              id="btnNewSkillTop"
              type="button"
              onClick={() => onSelectSkillPrompt('Create a new custom Fabric skill for: ')}
            >
              <span>+ New skill</span>
            </button>
          </div>
        </div>

        {/* Master Orchestrator Hero Card */}
        <div className="skills-hero-section">
          <div
            className="skills-hero-card"
            id="heroUsingFabricSkills"
            onClick={() => onInspectSkill('using_fabric_skills')}
          >
            <div className="skills-hero-top">
              <div className="skills-hero-badge">
                <span className="skills-pulse-dot" />
                <span>Master Skill Orchestrator</span>
              </div>
              <div className="skills-hero-status-pill">
                <span className="status-dot-green" />
                <span>Active & Routing</span>
              </div>
            </div>
            <div className="skills-hero-main">
              <div className="skills-hero-left">
                <h3 className="skills-hero-title">using_fabric_skills</h3>
                <p className="skills-hero-desc">
                  The dynamic router and meta-orchestrator for Fabric AI Studio. It evaluates prompt complexity, maps user intent to specialized sub-skills, and coordinates multi-tier Medallion workflows.
                </p>
                <div className="skills-hero-meta-row">
                  <button
                    className="skills-btn-inspect"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInspectSkill('using_fabric_skills');
                    }}
                  >
                    <Eye width={13} height={13} />
                    <span>View Routing Decision Matrix</span>
                  </button>
                  <span className="skills-hero-subcount">Coordinates 20+ Specialized Sub-Skills</span>
                </div>
              </div>
              <div className="skills-hero-right">
                <div className="skills-terminal-box">
                  <div className="skills-terminal-bar">
                    <span className="skills-term-dot red" />
                    <span className="skills-term-dot yellow" />
                    <span className="skills-term-dot green" />
                    <span className="skills-term-title">router_matrix.ascii</span>
                  </div>
                  <pre className="skills-terminal-code">
                    <code>{`User Request Arrives
  ├── Lakehouse / Tier Setup ─→ fabric_medallion_architecture
  ├── Table Ingestion / DAG ──→ fabric_ingestion_and_scheduling
  ├── SQL Dialect / AST ──────→ sql_transpilation_and_lineage
  ├── Quality Profiling ──────→ fabric_data_quality_and_testing
  └── Deletion / Safe-Gate ───→ fabric_governance_and_safe_delete`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="skills-filter-row">
          <button
            className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All ({skills.length})
          </button>
          <button
            className={`filter-pill ${activeFilter === 'workflow' ? 'active' : ''}`}
            onClick={() => setActiveFilter('workflow')}
          >
            Medallion & Workflows (5)
          </button>
          <button
            className={`filter-pill ${activeFilter === 'atomic' ? 'active' : ''}`}
            onClick={() => setActiveFilter('atomic')}
          >
            Item Operations (12)
          </button>
          <button
            className={`filter-pill ${activeFilter === 'pattern' ? 'active' : ''}`}
            onClick={() => setActiveFilter('pattern')}
          >
            Production Patterns (3)
          </button>
        </div>

        {/* 3-Column Skills Gallery Grid */}
        <div className="skills-gallery-grid" id="skillsGalleryGrid">
          {loading ? (
            <div className="tree-empty-hint">Loading specialized domain skills...</div>
          ) : filteredSkills.length === 0 ? (
            <div className="tree-empty-hint">No skills found matching &quot;{search}&quot;.</div>
          ) : (
            filteredSkills.map((skill) => (
              <div
                key={skill.name}
                className="skill-gallery-card"
                onClick={() => onInspectSkill(skill.name)}
              >
                <div className="skill-card-top">
                  <div className="skill-card-badge">
                    <Sparkles width={13} height={13} className="text-cyan-400" />
                    <span>{skill.tier.toUpperCase()}</span>
                  </div>
                  <span className="skill-card-status">Ready</span>
                </div>
                <h4 className="skill-card-title">{skill.displayName}</h4>
                <p className="skill-card-desc">{skill.description}</p>
                <div className="skill-card-footer">
                  <button
                    type="button"
                    className="skill-card-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInspectSkill(skill.name);
                    }}
                  >
                    <Eye width={12} height={12} />
                    <span>Inspect Runbook</span>
                  </button>
                  <button
                    type="button"
                    className="skill-card-run-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSkillPrompt(`Execute workflow using skill \`${skill.name}\`: `);
                    }}
                  >
                    <Play width={12} height={12} />
                    <span>Run</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
