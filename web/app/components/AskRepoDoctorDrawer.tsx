'use client';

import React, { useState, useEffect } from 'react';
import type {
  AskRepoDoctorResponseDto,
  CodeLocationCitationDto,
  FlowStepDto,
} from '@repo-doctor/shared';

interface AskRepoDoctorDrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly projectId?: string;
  readonly selectedRepoId?: string;
  readonly onQueryProject: (question: string) => Promise<AskRepoDoctorResponseDto>;
  readonly initialQuestion?: string;
  readonly onNavigateFlow?: (flowQuestion?: string) => void;
}

const STARTER_QUESTIONS = [
  'Explain how user login works end to end across frontend and backend.',
  'What are the consequences of changing auth.service.ts?',
  'I am new to this codebase: give me KT on the main project features.',
  'Which components and database tables handle user authentication?',
  'What happens if I modify a service in cadence-api?',
];

function renderInlineFormatting(text: string): React.ReactNode {
  if (!text) return null;
  const codeParts = text.split(/(`[^`]+`)/g);
  return codeParts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      const code = part.slice(1, -1);
      return (
        <code
          key={i}
          style={{
            backgroundColor: '#eff6ff',
            color: '#1d4ed8',
            padding: '0.12rem 0.4rem',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.85em',
            fontWeight: 700,
            border: '1px solid #dbeafe',
          }}
        >
          {code}
        </code>
      );
    }

    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bPart, j) => {
      if (bPart.startsWith('**') && bPart.endsWith('**')) {
        const boldText = bPart.slice(2, -2);
        return <strong key={`${i}-${j}`} style={{ fontWeight: 800, color: '#0f172a' }}>{boldText}</strong>;
      }

      const italicParts = bPart.split(/(\*[^*]+\*)/g);
      return italicParts.map((iPart, k) => {
        if (iPart.startsWith('*') && iPart.endsWith('*') && !iPart.startsWith('**')) {
          const itText = iPart.slice(1, -1);
          return <em key={`${i}-${j}-${k}`} style={{ color: '#475569', fontStyle: 'italic' }}>{itText}</em>;
        }
        return iPart;
      });
    });
  });
}

interface ParsedStep {
  number: number;
  title: string;
  lane: string;
  repo: string;
  component: string;
  method?: string;
  networkCall?: string;
  action: string;
}

interface ParsedFileProfile {
  fileName: string;
  repository: string;
  role: string;
  nodeType: string;
  filePath: string;
  plainEnglishRole: string;
  callers: string[];
  dependencies: string[];
}

function parseSeniorBriefing(raw: string) {
  const lines = raw.split('\n');

  let briefingTitle = '';
  let questionText = '';
  let executiveOverview = '';
  let fileProfile: ParsedFileProfile | null = null;
  const journeySteps: ParsedStep[] = [];
  const consequences: string[] = [];
  const whereToStart: string[] = [];
  let callTree = '';
  const friendlyDeps: string[] = [];
  let persistenceInfo = '';
  let eventingInfo = '';
  const citations: string[] = [];
  const genericSections: Array<{ title?: string; content: string[] }> = [];

  let currentSection = 'HEADER';
  let tempLines: string[] = [];

  const commitCurrentSection = (nextSection: string) => {
    if (tempLines.length > 0) {
      if (currentSection === 'EXECUTIVE_OVERVIEW') {
        executiveOverview = tempLines.join('\n').trim();
      } else if (currentSection === 'CALL_TREE') {
        callTree = tempLines.join('\n').replace(/```text/g, '').replace(/```/g, '').trim();
      } else if (currentSection === 'PERSISTENCE') {
        persistenceInfo = tempLines.join(' ').replace(/^Involved database entities:\s*/i, '').trim();
      } else if (currentSection === 'EVENTING') {
        eventingInfo = tempLines.join(' ').replace(/^Involved message queue\(s\):\s*/i, '').trim();
      } else if (currentSection === 'GENERIC') {
        genericSections.push({ content: [...tempLines] });
      }
      tempLines = [];
    }
    currentSection = nextSection;
  };

  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (currentSection === 'CALL_TREE') {
        continue;
      }
    }

    if (currentSection === 'CALL_TREE' && inCodeBlock) {
      tempLines.push(line);
      continue;
    }

    if (trimmed.startsWith('### 🎓') || trimmed.startsWith('### Senior Engineer') || trimmed.startsWith('### 🎓 Senior Engineer')) {
      commitCurrentSection('HEADER');
      briefingTitle = trimmed.replace(/^###\s*🎓?\s*/, '').replace(/^Senior Engineer Technical Briefing:\s*/i, '').trim();
      continue;
    }

    if (trimmed.startsWith('**Question:**')) {
      questionText = trimmed.replace(/^\*\*Question:\*\*\s*"?/, '').replace(/"?$/, '').trim();
      continue;
    }

    if (trimmed.startsWith('#### 📄 File Understanding:')) {
      commitCurrentSection('FILE_PROFILE');
      const fileNameMatch = trimmed.match(/####\s*📄?\s*File Understanding:\s*`?([^`\n]+)`?/i);
      fileProfile = {
        fileName: fileNameMatch ? fileNameMatch[1] : 'Component',
        repository: '',
        role: '',
        nodeType: '',
        filePath: '',
        plainEnglishRole: '',
        callers: [],
        dependencies: [],
      };
      continue;
    }

    if (fileProfile && currentSection === 'FILE_PROFILE') {
      if (trimmed.startsWith('• **Repository:**')) {
        fileProfile.repository = trimmed.replace(/^•\s*\*\*Repository:\*\*\s*\*?/, '').replace(/\*?$/, '').trim();
        continue;
      }
      if (trimmed.startsWith('• **Component Role:**')) {
        const roleMatch = trimmed.match(/`([^`]+)`\s*(?:\(`([^`]+)`\))?/);
        if (roleMatch) {
          fileProfile.role = roleMatch[1] || '';
          fileProfile.nodeType = roleMatch[2] || '';
        }
        continue;
      }
      if (trimmed.startsWith('• **File Path:**')) {
        fileProfile.filePath = trimmed.replace(/^•\s*\*\*File Path:\*\*\s*`?/, '').replace(/`?$/, '').trim();
        continue;
      }
      if (trimmed.startsWith('• **Plain-English Role:**')) {
        fileProfile.plainEnglishRole = trimmed.replace(/^•\s*\*\*Plain-English Role:\*\*\s*/, '').trim();
        continue;
      }
      if (trimmed.startsWith('**Who Calls or Imports This File')) {
        commitCurrentSection('FILE_CALLERS');
        continue;
      }
    }

    if (currentSection === 'FILE_CALLERS') {
      if (trimmed.startsWith('**What This File Depends On')) {
        commitCurrentSection('FILE_DEPS');
        continue;
      }
      if (trimmed.startsWith('**⚠️ Consequences')) {
        commitCurrentSection('CONSEQUENCES');
        continue;
      }
      if (trimmed.startsWith('•')) {
        fileProfile?.callers.push(trimmed.replace(/^•\s*/, '').replace(/`/g, ''));
        continue;
      }
    }

    if (currentSection === 'FILE_DEPS') {
      if (trimmed.startsWith('**⚠️ Consequences')) {
        commitCurrentSection('CONSEQUENCES');
        continue;
      }
      if (trimmed.startsWith('•')) {
        fileProfile?.dependencies.push(trimmed.replace(/^•\s*/, '').replace(/`/g, ''));
        continue;
      }
    }

    if (trimmed.startsWith('**Executive Architecture Overview:**')) {
      commitCurrentSection('EXECUTIVE_OVERVIEW');
      continue;
    }

    if (trimmed.startsWith('**Step-by-Step Execution Journey')) {
      commitCurrentSection('JOURNEY');
      continue;
    }

    if (trimmed.startsWith('**⚠️ Consequences')) {
      commitCurrentSection('CONSEQUENCES');
      continue;
    }

    if (trimmed.startsWith('**🚀 Where to Start')) {
      commitCurrentSection('WHERE_TO_START');
      continue;
    }

    if (trimmed.startsWith('**Step-by-Step Architectural Flow & Methods:**')) {
      commitCurrentSection('ARCH_METHODS');
      continue;
    }

    if (trimmed.startsWith('**🌳 Visual Call & Method Tree:**')) {
      commitCurrentSection('CALL_TREE');
      continue;
    }

    if (trimmed.startsWith('**📋 Friendly File Dependencies')) {
      commitCurrentSection('FRIENDLY_DEPS');
      continue;
    }

    if (trimmed.startsWith('**Persistence Layer:**')) {
      commitCurrentSection('PERSISTENCE');
      continue;
    }

    if (trimmed.startsWith('**Asynchronous Eventing:**')) {
      commitCurrentSection('EVENTING');
      continue;
    }

    if (trimmed.startsWith('**Grounding & Evidence Citations:**')) {
      commitCurrentSection('CITATIONS');
      continue;
    }

    if (currentSection === 'JOURNEY') {
      const stepHeaderMatch = trimmed.match(/^(\d+)\.\s*\*\*([^*]+)\*\*\s*\((?:'|`|‘)?([A-Z]+)(?:'|`|’)?\s+in\s+\*([^*]+)\*\):/);
      if (stepHeaderMatch) {
        journeySteps.push({
          number: parseInt(stepHeaderMatch[1], 10),
          title: stepHeaderMatch[2].trim(),
          lane: stepHeaderMatch[3].trim(),
          repo: stepHeaderMatch[4].trim(),
          component: '',
          method: '',
          networkCall: '',
          action: '',
        });
        continue;
      }

      if (journeySteps.length > 0) {
        const activeStep = journeySteps[journeySteps.length - 1];
        if (trimmed.includes('↳ Component:')) {
          const parts = trimmed.replace(/^↳\s*Component:\s*/, '').split('➔').map((s) => s.trim().replace(/`/g, ''));
          activeStep.component = parts[0] || '';
          activeStep.method = parts[1] || '';
          if (parts.length > 2) {
            activeStep.networkCall = parts[2] || '';
          }
          continue;
        }
        if (trimmed.includes('↳ Action:')) {
          activeStep.action = trimmed.replace(/^↳\s*Action:\s*/, '').trim();
          continue;
        }
      }
      continue;
    }

    if (currentSection === 'CONSEQUENCES') {
      if (trimmed.startsWith('•')) {
        consequences.push(trimmed.replace(/^•\s*/, ''));
      } else if (trimmed && !trimmed.startsWith('**')) {
        consequences.push(trimmed);
      }
      continue;
    }

    if (currentSection === 'WHERE_TO_START') {
      if (trimmed.startsWith('•')) {
        whereToStart.push(trimmed.replace(/^•\s*/, ''));
      } else if (trimmed && !trimmed.startsWith('**')) {
        whereToStart.push(trimmed);
      }
      continue;
    }

    if (currentSection === 'FRIENDLY_DEPS') {
      if (trimmed.startsWith('•')) {
        friendlyDeps.push(trimmed.replace(/^•\s*/, ''));
      }
      continue;
    }

    if (currentSection === 'CITATIONS') {
      if (trimmed.startsWith('•')) {
        citations.push(trimmed.replace(/^•\s*`?/, '').replace(/`?$/, ''));
      }
      continue;
    }

    tempLines.push(line);
  }

  commitCurrentSection('DONE');

  return {
    briefingTitle,
    questionText,
    executiveOverview,
    fileProfile,
    journeySteps,
    consequences,
    whereToStart,
    callTree,
    friendlyDeps,
    persistenceInfo,
    eventingInfo,
    citations,
    genericSections,
  };
}

interface BriefingAnswerViewerProps {
  readonly answer: string;
  readonly query: string;
  readonly onNavigateFlow?: () => void;
}

function BriefingAnswerViewer({ answer, query, onNavigateFlow }: BriefingAnswerViewerProps): React.JSX.Element {
  const parsed = parseSeniorBriefing(answer);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Header Hero Card */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
          border: '1.5px solid #bfdbfe',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '0.2rem 0.55rem',
              borderRadius: '4px',
              backgroundColor: '#dbeafe',
              color: '#1e40af',
            }}
          >
            🎓 Senior Architect Briefing
          </span>

          {onNavigateFlow && (
            <button
              type="button"
              className="primary-btn"
              onClick={onNavigateFlow}
              style={{
                fontSize: '0.8rem',
                padding: '0.35rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>🎬</span>
              <span>View Storyboard in Architecture ➔</span>
            </button>
          )}
        </div>

        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e3a8a', margin: 0, lineHeight: 1.35 }}>
          {parsed.briefingTitle || 'System Architecture Technical Flow'}
        </h3>

        <div
          style={{
            fontSize: '0.85rem',
            color: '#334155',
            backgroundColor: '#ffffff',
            padding: '0.5rem 0.85rem',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span style={{ fontWeight: 700, color: '#1e40af' }}>💬 Query:</span>
          <span style={{ fontStyle: 'italic', color: '#475569' }}>
            "{parsed.questionText || query}"
          </span>
        </div>
      </div>

      {/* 2. File Profile (When user asked about a specific file) */}
      {parsed.fileProfile && (
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '10px',
            backgroundColor: '#ffffff',
            border: '1.5px solid #cbd5e1',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>📄</span>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {parsed.fileProfile.fileName}
              </h4>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#3730a3' }}>
                {parsed.fileProfile.role || 'COMPONENT'}
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569' }}>
                📁 {parsed.fileProfile.repository || 'system'}
              </span>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace' }}>
            📍 {parsed.fileProfile.filePath}
          </div>

          {parsed.fileProfile.plainEnglishRole && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem 0.9rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>💡</span> WHAT THIS FILE DOES:
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#14532d', lineHeight: 1.5 }}>
                {parsed.fileProfile.plainEnglishRole}
              </p>
            </div>
          )}

          {/* Inbound Callers & Outbound Dependencies */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {parsed.fileProfile.callers.length > 0 && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                  📥 Inbound Callers ({parsed.fileProfile.callers.length}):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {parsed.fileProfile.callers.map((c, i) => (
                    <div key={i} style={{ fontSize: '0.78rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ color: '#2563eb' }}>↳</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsed.fileProfile.dependencies.length > 0 && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                  📤 Outbound Dependencies ({parsed.fileProfile.dependencies.length}):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {parsed.fileProfile.dependencies.map((d, i) => (
                    <div key={i} style={{ fontSize: '0.78rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ color: '#16a34a' }}>↳</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Executive Architecture Overview */}
      {parsed.executiveOverview && (
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '10px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderLeft: '4px solid #2563eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🏢</span>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Executive Architecture Overview
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.6 }}>
            {renderInlineFormatting(parsed.executiveOverview)}
          </p>
        </div>
      )}

      {/* 4. Step-by-Step Execution Journey (Interactive Cards) */}
      {parsed.journeySteps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.2rem' }}>
              🎬 Step-by-Step Execution Journey (Client ➔ API ➔ Service ➔ Database)
            </h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
              How user interactions flow across browser components, backend controllers, and database tables:
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {parsed.journeySteps.map((step) => {
              const laneColor =
                step.lane === 'CLIENT'
                  ? { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: '🖥️' }
                  : step.lane === 'API'
                  ? { bg: '#fef3c7', border: '#fde68a', text: '#92400e', icon: '⚡' }
                  : step.lane === 'SERVICE'
                  ? { bg: '#faf5ff', border: '#e9d5ff', text: '#7e22ce', icon: '⚙️' }
                  : { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', icon: '🗄️' };

              return (
                <div
                  key={step.number}
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: '0.85rem',
                    padding: '0.9rem 1rem',
                    borderRadius: '10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  {/* Step Number Circle */}
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {step.number}
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {/* Header: Title + Lane Badge + Repo */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.35rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                        {step.title}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.45rem',
                            borderRadius: '4px',
                            backgroundColor: laneColor.bg,
                            border: `1px solid ${laneColor.border}`,
                            color: laneColor.text,
                          }}
                        >
                          {laneColor.icon} {step.lane}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          📁 {step.repo}
                        </span>
                      </div>
                    </div>

                    {/* Component + Method + Network Call */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                        {step.component}
                      </span>
                      {step.method && (
                        <>
                          <span style={{ color: '#2563eb', fontWeight: 700, fontSize: '0.8rem' }}>➔</span>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              color: '#1d4ed8',
                              backgroundColor: '#eff6ff',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              border: '1px solid #dbeafe',
                            }}
                          >
                            ƒ {step.method}
                          </span>
                        </>
                      )}
                      {step.networkCall && (
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            color: '#92400e',
                            backgroundColor: '#fef3c7',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            border: '1px solid #fde68a',
                          }}
                        >
                          {step.networkCall}
                        </span>
                      )}
                    </div>

                    {/* Action Description */}
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                      {step.action}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Consequences & Blast Radius Alert Box */}
      {parsed.consequences.length > 0 && (
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '10px',
            backgroundColor: '#fffbeb',
            border: '1.5px solid #fde68a',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.2rem' }}>💥</span>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#92400e', margin: 0 }}>
              Consequences of Modifying (Blast Radius)
            </h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {parsed.consequences.map((c, i) => (
              <div key={i} style={{ fontSize: '0.85rem', color: '#78350f', lineHeight: 1.5 }}>
                {renderInlineFormatting(c)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Where to Start Guide (Onboarding) */}
      {parsed.whereToStart.length > 0 && (
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '10px',
            backgroundColor: '#f0fdf4',
            border: '1.5px solid #bbf7d0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🚀</span>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#166534', margin: 0 }}>
              Where to Start (New Developer Onboarding Guide)
            </h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {parsed.whereToStart.map((w, i) => (
              <div key={i} style={{ fontSize: '0.85rem', color: '#14532d', lineHeight: 1.5 }}>
                {renderInlineFormatting(w)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Visual Call Tree Terminal */}
      {parsed.callTree && (
        <div
          style={{
            borderRadius: '10px',
            overflow: 'hidden',
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <div
            style={{
              padding: '0.5rem 0.85rem',
              backgroundColor: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #334155',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#94a3b8', marginLeft: '0.5rem' }}>
                🌳 Call &amp; Method Hierarchy
              </span>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>verified AST</span>
          </div>

          <pre
            style={{
              margin: 0,
              padding: '1rem',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '0.825rem',
              lineHeight: 1.6,
              color: '#38bdf8',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {parsed.callTree}
          </pre>
        </div>
      )}

      {/* 8. Friendly Dependencies */}
      {parsed.friendlyDeps.length > 0 && (
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '10px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.1rem' }}>📋</span>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Friendly File Dependencies ({parsed.friendlyDeps.length})
            </h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {parsed.friendlyDeps.map((dep, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: '0.82rem',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '6px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#334155',
                  lineHeight: 1.45,
                }}
              >
                {renderInlineFormatting(dep)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9. Persistence & Queues metadata pills */}
      {(parsed.persistenceInfo || parsed.eventingInfo) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          {parsed.persistenceInfo && (
            <div style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', borderRadius: '6px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
              <strong>🗄️ Database Entities:</strong> {parsed.persistenceInfo}
            </div>
          )}
          {parsed.eventingInfo && (
            <div style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', borderRadius: '6px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', color: '#7e22ce' }}>
              <strong>📬 Message Queues:</strong> {parsed.eventingInfo}
            </div>
          )}
        </div>
      )}

      {/* 10. Generic fallback sections */}
      {parsed.genericSections.map((sec, sIdx) => {
        const text = sec.content.join('\n').trim();
        if (!text) return null;
        return (
          <div key={sIdx} style={{ fontSize: '0.9rem', lineHeight: 1.6, color: '#334155' }}>
            {renderInlineFormatting(text)}
          </div>
        );
      })}
    </div>
  );
}

export function AskRepoDoctorDrawer({
  isOpen,
  onClose,
  projectId,
  selectedRepoId,
  onQueryProject,
  initialQuestion = '',
  onNavigateFlow,
}: AskRepoDoctorDrawerProps): React.JSX.Element | null {
  const [query, setQuery] = useState<string>(initialQuestion);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AskRepoDoctorResponseDto | null>(null);
  const [showEvidenceDetails, setShowEvidenceDetails] = useState<boolean>(false);
  const [expandedCitationIndex, setExpandedCitationIndex] = useState<number | null>(0);

  // Update query when initialQuestion changes
  useEffect(() => {
    if (initialQuestion) {
      setQuery(initialQuestion);
      void handleExecuteQuery(initialQuestion);
    }
  }, [initialQuestion]);

  if (!isOpen) return null;

  const handleExecuteQuery = async (questionText: string): Promise<void> => {
    const trimmed = questionText.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await onQueryProject(trimmed);
      setResponse(res);
      setShowEvidenceDetails(false);
      setExpandedCitationIndex(0);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      let friendlyMsg = rawMsg;
      if (rawMsg.includes('404') || rawMsg.includes('Not Found') || rawMsg.includes('Cannot POST')) {
        friendlyMsg = 'The analysis engine could not be reached (HTTP 404). Please ensure the backend is running with the latest routes.';
      } else if (rawMsg.toLowerCase().includes('failed to fetch') || rawMsg.toLowerCase().includes('network')) {
        friendlyMsg = 'Connection error: unable to reach the RepoDoctor server. Please check your network connection and server status.';
      } else if (rawMsg.includes('401') || rawMsg.toLowerCase().includes('unauthorized')) {
        friendlyMsg = 'Your session has expired or authentication is required. Please sign in again.';
      } else if (rawMsg.includes('403') || rawMsg.toLowerCase().includes('forbidden')) {
        friendlyMsg = 'You do not have permission to query this project.';
      }
      setError(friendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    void handleExecuteQuery(query);
  };

  const handleViewFlow = (): void => {
    if (onNavigateFlow) {
      onNavigateFlow(query);
      onClose();
    }
  };

  // Generate contextual follow-ups based on the response
  const getFollowUpSuggestions = (res: AskRepoDoctorResponseDto): string[] => {
    const suggestions: string[] = [];
    if (res.participatingComponents.some((c) => c.type === 'DATABASE')) {
      suggestions.push('Which database tables are read from or written to?');
    }
    if (res.participatingComponents.some((c) => c.type === 'SERVICE')) {
      suggestions.push('What is the downstream blast radius if this service is modified?');
    }
    if (res.participatingRepositories.length > 1) {
      suggestions.push('Explain the cross-repository protocol between these services');
    } else {
      suggestions.push('What external services or queues are connected?');
    }
    return suggestions.slice(0, 3);
  };

  return (
    <div
      className="modal-overlay"
      data-testid="ask-repodoctor-drawer"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        className="drawer-panel"
        style={{
          width: '100%',
          maxWidth: '840px',
          height: '100vh',
          backgroundColor: '#ffffff',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideInRight 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 1. Drawer Header ── */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'var(--brand-primary, #2563eb)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                fontWeight: 700,
              }}
            >
              💬
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                Ask RepoDoctor
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', margin: 0 }}>
                Explain features, visual flows, and dependencies backed strictly by source code evidence
              </p>
            </div>
          </div>
          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
            aria-label="Close Ask Drawer"
            style={{ padding: '0.4rem 0.75rem', fontSize: '1rem', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* ── 2. Large Question Composer Section ── */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                data-testid="ask-question-input"
                className="input-field"
                placeholder="Ask how something works, blast radius, or cross-repo flows..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.9rem 6rem 0.9rem 1.1rem',
                  fontSize: '1rem',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              />
              <button
                type="submit"
                data-testid="ask-question-btn"
                className="primary-btn"
                disabled={isLoading || !query.trim()}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '6px',
                  bottom: '6px',
                  padding: '0 1.25rem',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {isLoading ? 'Analyzing...' : 'Ask'}
              </button>
            </div>

            {/* Starter Suggestion Chips */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.4rem' }}>
                SUGGESTED QUESTIONS:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {STARTER_QUESTIONS.map((sq) => (
                  <button
                    key={sq}
                    type="button"
                    onClick={() => {
                      setQuery(sq);
                      void handleExecuteQuery(sq);
                    }}
                    style={{
                      padding: '0.3rem 0.7rem',
                      fontSize: '0.75rem',
                      borderRadius: '9999px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#334155',
                      cursor: 'pointer',
                      textAlign: 'left',
                      lineHeight: 1.3,
                    }}
                  >
                    {sq}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* ── 3. Conversational Content Area ── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 1.5s linear infinite' }}>⚙️</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.4rem' }}>
                Analyzing System Architecture...
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0, maxWidth: '420px', marginInline: 'auto' }}>
                Tracing component calls, database operations, and evidence citations across repositories without hallucinations.
              </p>
            </div>
          )}

          {error && (
            <div
              className="card-section"
              style={{
                border: '1px solid #fecaca',
                backgroundColor: '#fef2f2',
                borderRadius: '10px',
                padding: '1.25rem',
                margin: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                <h4 style={{ margin: 0, fontWeight: 700, color: '#991b1b', fontSize: '0.95rem' }}>
                  Unable to Answer Question
                </h4>
              </div>
              <p style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', color: '#b91c1c', lineHeight: 1.5 }}>
                {error}
              </p>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void handleExecuteQuery(query)}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.35rem 0.85rem',
                  borderColor: '#fca5a5',
                  color: '#991b1b',
                  backgroundColor: '#ffffff',
                }}
              >
                ↻ Try Again
              </button>
            </div>
          )}

          {!isLoading && !response && !error && (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧭</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>
                Ask Anything About This Project
              </h3>
              <p style={{ fontSize: '0.95rem', maxWidth: '460px', margin: '0 auto', lineHeight: 1.6 }}>
                RepoDoctor correlates route handlers, business services, database operations, and message queues to explain how functionality actually flows through code.
              </p>
            </div>
          )}

          {!isLoading && response && (
            <div data-testid="ask-response-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* ── Answer Card ── */}
              <div
                style={{
                  padding: '1.5rem',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                {/* Top Status Pill: Honest Grounding, NO 100% Badges */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        backgroundColor: response.isInferred ? '#fef3c7' : '#dcfce7',
                        color: response.isInferred ? '#92400e' : '#166534',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span>{response.isInferred ? 'ℹ' : '✓'}</span>
                      <span>{response.isInferred ? 'Inferred Flow' : 'Verified Static Evidence'}</span>
                    </span>

                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      ({response.participatingComponents.length} components, {response.citations.length} code citations)
                    </span>
                  </div>

                  {/* One-Click "View Flow" Action */}
                  {response.flowSteps.length > 0 && onNavigateFlow && (
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={handleViewFlow}
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.35rem 0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span>🕸️</span>
                      <span>View Flow in Architecture</span>
                    </button>
                  )}
                </div>

                {/* User-Friendly Structured Briefing Viewer */}
                <BriefingAnswerViewer
                  answer={response.answer}
                  query={query}
                  onNavigateFlow={handleViewFlow}
                />
              </div>

              {/* ── Step-by-Step Flow Timeline (fallback if not in briefing) ── */}
              {response.flowSteps.length > 0 && !response.answer.includes('Step-by-Step Execution Journey') && (
                <div
                  style={{
                    padding: '1.25rem',
                    borderRadius: '12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Step-by-Step Execution Flow
                    </h3>
                    {onNavigateFlow && (
                      <button
                        type="button"
                        onClick={handleViewFlow}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Open interactive diagram ➔
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {response.flowSteps.map((step: FlowStepDto) => (
                      <div
                        key={step.stepNumber}
                        style={{
                          display: 'flex',
                          gap: '0.85rem',
                          padding: '0.85rem 1rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {step.stepNumber}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                              {step.componentName}
                            </span>
                            {step.methodName && (
                              <>
                                <span style={{ color: '#2563eb', fontWeight: 700 }}>➔</span>
                                <span
                                  style={{
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    color: '#1d4ed8',
                                    backgroundColor: '#eff6ff',
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: '4px',
                                    border: '1px solid #dbeafe',
                                  }}
                                >
                                  {step.methodName}
                                </span>
                              </>
                            )}
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                backgroundColor: '#e2e8f0',
                                color: '#334155',
                                fontWeight: 600,
                              }}
                            >
                              {step.componentType}
                            </span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                backgroundColor: '#dbeafe',
                                color: '#1e40af',
                                fontWeight: 600,
                              }}
                            >
                              📁 {step.repositoryName}
                            </span>
                            {step.edgeType && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '4px',
                                  backgroundColor: '#fef3c7',
                                  color: '#92400e',
                                  fontWeight: 600,
                                }}
                              >
                                {step.edgeType}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569', lineHeight: 1.5 }}>
                            {step.description}
                          </p>
                          {step.targetName && (
                            <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#2563eb', fontWeight: 600 }}>
                              ↳ Connects to: {step.targetName}
                              {step.targetMethodName && (
                                <span style={{ fontFamily: 'monospace', marginLeft: '0.3rem', color: '#1d4ed8' }}>
                                  ➔ {step.targetMethodName}
                                </span>
                              )}
                              {step.targetRepositoryName && step.targetRepositoryName !== step.repositoryName && (
                                <span style={{ marginLeft: '0.4rem', color: '#b45309' }}>
                                  [Cross-Repo: {step.targetRepositoryName}]
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Contextual Follow-Up Suggestions ── */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>
                  FOLLOW-UP QUESTIONS:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {getFollowUpSuggestions(response).map((fq, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setQuery(fq);
                        void handleExecuteQuery(fq);
                      }}
                      style={{
                        padding: '0.6rem 0.9rem',
                        fontSize: '0.85rem',
                        borderRadius: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>💬 {fq}</span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>➔</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Expandable "Why This Answer?" Evidence Section ── */}
              <div
                style={{
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  padding: '1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowEvidenceDetails(!showEvidenceDetails)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>🔍</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                      Why this answer? Supporting Code Evidence ({response.citations.length})
                    </span>
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    {showEvidenceDetails ? 'Hide ▴' : 'Inspect Evidence ▾'}
                  </span>
                </div>

                {showEvidenceDetails && (
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                      This explanation is synthesized directly from verified AST declarations, route decorators, and dependency citations across {response.participatingRepositories.length} repository(s). No speculative code was synthesized.
                    </p>

                    {response.citations.map((cite: CodeLocationCitationDto, idx: number) => {
                      const isExpanded = expandedCitationIndex === idx;
                      return (
                        <div
                          key={idx}
                          style={{
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              padding: '0.65rem 0.85rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              backgroundColor: isExpanded ? '#f1f5f9' : '#f8fafc',
                            }}
                            onClick={() => setExpandedCitationIndex(isExpanded ? null : idx)}
                          >
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600, color: '#2563eb' }}>
                              📄 {cite.filePath}:{cite.lineStart}-{cite.lineEnd}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {isExpanded ? 'Collapse' : 'View Code'}
                            </span>
                          </div>

                          {isExpanded && cite.codeSnippet && (
                            <pre
                              style={{
                                margin: 0,
                                padding: '0.75rem',
                                backgroundColor: '#ffffff',
                                borderTop: '1px solid #e2e8f0',
                                fontFamily: 'monospace',
                                fontSize: '0.8rem',
                                overflowX: 'auto',
                                color: '#334155',
                                lineHeight: 1.5,
                              }}
                            >
                              {cite.codeSnippet}
                            </pre>
                          )}
                        </div>
                      );
                    })}

                    {/* Documented Limitations */}
                    {response.limitations.length > 0 && (
                      <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e', marginBottom: '0.25rem' }}>
                          Analysis Limitations:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.75rem', color: '#b45309' }}>
                          {response.limitations.map((lim, lIdx) => (
                            <li key={lIdx}>{lim}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
