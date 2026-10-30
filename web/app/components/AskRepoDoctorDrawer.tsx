'use client';

import React, { useState, useEffect } from 'react';
import type {
  AskRepoDoctorResponseDto,
  CodeLocationCitationDto,
  FlowStepDto,
} from '@repo-doctor/shared';
import { Button } from './atlassian/Button';
import { Lozenge } from './atlassian/Lozenge';
import { Badge } from './atlassian/Badge';
import { EmptyState } from './atlassian/EmptyState';

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

/* ── Atlassian Design System Clean SVG Icons ── */

function ChatSparkleIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GraphFlowIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="5" cy="6" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="19" cy="6" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M7.5 7.5L10 16M16.5 7.5L14 16" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function StoryboardIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M10 8l6 4-6 4V8z" fill="currentColor" />
    </svg>
  );
}

function RepoBranchIcon(): React.JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 6a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileDocumentIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" />
      <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function AlertTriangleIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        stroke="#FFAB00"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="12" y1="9" x2="12" y2="13" stroke="#FFAB00" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12.01" y2="17" stroke="#FFAB00" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CompassIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="#006644" strokeWidth="2" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="#006644" />
    </svg>
  );
}

function ChevronDownIcon({ isExpanded }: { readonly isExpanded: boolean }): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
      }}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
            backgroundColor: '#F4F5F7',
            color: '#172B4D',
            padding: '2px 6px',
            borderRadius: '3px',
            fontFamily: 'SFMono-Medium, "Segoe UI Mono", Menlo, Consolas, monospace',
            fontSize: '0.85em',
            fontWeight: 600,
            border: '1px solid #DFE1E6',
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
        return (
          <strong key={`${i}-${j}`} style={{ fontWeight: 600, color: '#172B4D' }}>
            {boldText}
          </strong>
        );
      }

      const italicParts = bPart.split(/(\*[^*]+\*)/g);
      return italicParts.map((iPart, k) => {
        if (iPart.startsWith('*') && iPart.endsWith('*') && !iPart.startsWith('**')) {
          const itText = iPart.slice(1, -1);
          return (
            <em key={`${i}-${j}-${k}`} style={{ color: '#6B778C', fontStyle: 'italic' }}>
              {itText}
            </em>
          );
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
      {/* ── 1. Header Hero Card (ADS Styled) ── */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: '3px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #DFE1E6',
          boxShadow: '0 1px 1px rgba(9, 30, 66, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <Lozenge appearance="inprogress" isBold>
            Senior Architect Briefing
          </Lozenge>

          {onNavigateFlow && (
            <Button appearance="primary" spacing="compact" onClick={onNavigateFlow}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <StoryboardIcon />
                <span>View Storyboard in Architecture →</span>
              </span>
            </Button>
          )}
        </div>

        <h3
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#172B4D',
            margin: 0,
            lineHeight: '24px',
          }}
        >
          {parsed.briefingTitle || 'System Architecture Technical Flow'}
        </h3>

        {/* Query Quote Panel */}
        <div
          style={{
            fontSize: '13px',
            color: '#172B4D',
            backgroundColor: '#FAFBFC',
            padding: '8px 12px',
            borderRadius: '3px',
            border: '1px solid #DFE1E6',
            borderLeft: '3px solid #0052CC',
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#0052CC',
              flexShrink: 0,
            }}
          >
            Query
          </span>
          <span style={{ color: '#42526E', lineHeight: '20px' }}>
            "{parsed.questionText || query}"
          </span>
        </div>
      </div>

      {/* ── 2. File Profile (When user queried a specific file) ── */}
      {parsed.fileProfile && (
        <div
          style={{
            padding: '16px',
            borderRadius: '3px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #DFE1E6',
            boxShadow: '0 1px 1px rgba(9, 30, 66, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '3px',
                  backgroundColor: '#DEEBFF',
                  color: '#0052CC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileDocumentIcon />
              </div>
              <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#172B4D', margin: 0 }}>
                {parsed.fileProfile.fileName}
              </h4>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lozenge appearance="new" isBold>
                {parsed.fileProfile.role || 'COMPONENT'}
              </Lozenge>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  color: '#6B778C',
                  backgroundColor: '#FAFBFC',
                  border: '1px solid #DFE1E6',
                  borderRadius: '3px',
                  padding: '2px 6px',
                }}
              >
                <RepoBranchIcon />
                <span>{parsed.fileProfile.repository || 'system'}</span>
              </span>
            </div>
          </div>

          <div
            style={{
              fontSize: '12px',
              fontFamily: 'SFMono-Medium, "Segoe UI Mono", Menlo, Consolas, monospace',
              color: '#42526E',
              backgroundColor: '#FAFBFC',
              padding: '6px 10px',
              borderRadius: '3px',
              border: '1px solid #DFE1E6',
              wordBreak: 'break-all',
            }}
          >
            {parsed.fileProfile.filePath}
          </div>

          {parsed.fileProfile.plainEnglishRole && (
            <div
              style={{
                backgroundColor: '#E3FCEF',
                border: '1px solid #ABF5D1',
                borderLeft: '3px solid #36B37E',
                borderRadius: '3px',
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#006644',
                  marginBottom: '4px',
                }}
              >
                What this file does
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#172B4D', lineHeight: '20px' }}>
                {parsed.fileProfile.plainEnglishRole}
              </p>
            </div>
          )}

          {/* Inbound Callers & Outbound Dependencies */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
            {parsed.fileProfile.callers.length > 0 && (
              <div style={{ padding: '12px', borderRadius: '3px', backgroundColor: '#FAFBFC', border: '1px solid #DFE1E6' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '6px' }}>
                  Inbound Callers ({parsed.fileProfile.callers.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {parsed.fileProfile.callers.map((c, i) => (
                    <div key={i} style={{ fontSize: '12px', color: '#42526E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#0052CC', fontWeight: 700 }}>↳</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#172B4D' }}>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsed.fileProfile.dependencies.length > 0 && (
              <div style={{ padding: '12px', borderRadius: '3px', backgroundColor: '#FAFBFC', border: '1px solid #DFE1E6' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '6px' }}>
                  Outbound Dependencies ({parsed.fileProfile.dependencies.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {parsed.fileProfile.dependencies.map((d, i) => (
                    <div key={i} style={{ fontSize: '12px', color: '#42526E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#006644', fontWeight: 700 }}>↳</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#172B4D' }}>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 3. Executive Architecture Overview ── */}
      {parsed.executiveOverview && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '3px',
            backgroundColor: '#FAFBFC',
            border: '1px solid #DFE1E6',
            borderLeft: '3px solid #0052CC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#0052CC',
              }}
            >
              Executive Architecture Overview
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#42526E', lineHeight: '20px' }}>
            {renderInlineFormatting(parsed.executiveOverview)}
          </p>
        </div>
      )}

      {/* ── 4. Step-by-Step Execution Journey (Interactive Cards) ── */}
      {parsed.journeySteps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#172B4D', margin: '0 0 2px' }}>
              Step-by-Step Execution Journey (Client → API → Service → Database)
            </h4>
            <p style={{ margin: 0, fontSize: '12px', color: '#6B778C' }}>
              How user interactions flow across browser components, backend controllers, and database tables:
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {parsed.journeySteps.map((step) => {
              const laneLozengeAppearance =
                step.lane === 'CLIENT'
                  ? 'inprogress'
                  : step.lane === 'API'
                  ? 'moved'
                  : step.lane === 'SERVICE'
                  ? 'new'
                  : 'success';

              return (
                <div
                  key={step.number}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '14px 16px',
                    borderRadius: '3px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #DFE1E6',
                    boxShadow: '0 1px 1px rgba(9, 30, 66, 0.08)',
                  }}
                >
                  {/* Step Number Circle */}
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: '#0052CC',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    {step.number}
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* Header: Title + Lane Lozenge + Repo */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#172B4D' }}>
                        {step.title}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Lozenge appearance={laneLozengeAppearance}>
                          {step.lane}
                        </Lozenge>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            color: '#6B778C',
                          }}
                        >
                          <RepoBranchIcon />
                          <span>{step.repo}</span>
                        </span>
                      </div>
                    </div>

                    {/* Component + Method + Network Call */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#172B4D' }}>
                        {step.component}
                      </span>
                      {step.method && (
                        <>
                          <span style={{ color: '#0052CC', fontWeight: 700, fontSize: '12px' }}>→</span>
                          <span
                            style={{
                              fontFamily: 'SFMono-Medium, "Segoe UI Mono", Menlo, Consolas, monospace',
                              fontWeight: 600,
                              fontSize: '12px',
                              color: '#0052CC',
                              backgroundColor: '#DEEBFF',
                              padding: '2px 6px',
                              borderRadius: '3px',
                            }}
                          >
                            {step.method}
                          </span>
                        </>
                      )}
                      {step.networkCall && (
                        <span
                          style={{
                            fontFamily: 'SFMono-Medium, "Segoe UI Mono", Menlo, Consolas, monospace',
                            fontWeight: 600,
                            fontSize: '11px',
                            color: '#172B4D',
                            backgroundColor: '#FFF0B3',
                            padding: '2px 6px',
                            borderRadius: '3px',
                          }}
                        >
                          {step.networkCall}
                        </span>
                      )}
                    </div>

                    {/* Action Description */}
                    <p style={{ margin: 0, fontSize: '13px', color: '#42526E', lineHeight: '20px' }}>
                      {step.action}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 5. Consequences & Blast Radius Alert Box (ADS Warning Flag) ── */}
      {parsed.consequences.length > 0 && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '3px',
            backgroundColor: '#FFFAE6',
            border: '1px solid #FFE380',
            borderLeft: '3px solid #FFAB00',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangleIcon />
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#172B4D', margin: 0 }}>
              Consequences of Modifying (Blast Radius)
            </h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {parsed.consequences.map((c, i) => (
              <div key={i} style={{ fontSize: '13px', color: '#42526E', lineHeight: '20px' }}>
                {renderInlineFormatting(c)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 6. Where to Start Guide (ADS Success Flag) ── */}
      {parsed.whereToStart.length > 0 && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '3px',
            backgroundColor: '#E3FCEF',
            border: '1px solid #ABF5D1',
            borderLeft: '3px solid #36B37E',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CompassIcon />
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#006644', margin: 0 }}>
              Where to Start (New Developer Onboarding Guide)
            </h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {parsed.whereToStart.map((w, i) => (
              <div key={i} style={{ fontSize: '13px', color: '#172B4D', lineHeight: '20px' }}>
                {renderInlineFormatting(w)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 7. Visual Call Tree Terminal (Clean ADS Code Container) ── */}
      {parsed.callTree && (
        <div
          style={{
            borderRadius: '3px',
            overflow: 'hidden',
            backgroundColor: '#091E42',
            border: '1px solid #253858',
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              backgroundColor: '#172B4D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #253858',
            }}
          >
            <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#DFE1E6', fontWeight: 600 }}>
              Call &amp; Method Hierarchy
            </span>
            <span style={{ fontSize: '11px', color: '#8993A4' }}>verified AST</span>
          </div>

          <pre
            style={{
              margin: 0,
              padding: '12px 16px',
              fontFamily: 'SFMono-Medium, "Segoe UI Mono", Menlo, Consolas, monospace',
              fontSize: '12px',
              lineHeight: 1.6,
              color: '#4C9AFF',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {parsed.callTree}
          </pre>
        </div>
      )}

      {/* ── 8. Friendly Dependencies ── */}
      {parsed.friendlyDeps.length > 0 && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '3px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #DFE1E6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#172B4D', margin: 0 }}>
              Friendly File Dependencies ({parsed.friendlyDeps.length})
            </h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {parsed.friendlyDeps.map((dep, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: '13px',
                  padding: '6px 10px',
                  borderRadius: '3px',
                  backgroundColor: '#FAFBFC',
                  border: '1px solid #DFE1E6',
                  color: '#42526E',
                  lineHeight: '18px',
                }}
              >
                {renderInlineFormatting(dep)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 9. Persistence & Queues metadata pills ── */}
      {(parsed.persistenceInfo || parsed.eventingInfo) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {parsed.persistenceInfo && (
            <Lozenge appearance="success">
              Database: {parsed.persistenceInfo}
            </Lozenge>
          )}
          {parsed.eventingInfo && (
            <Lozenge appearance="new">
              Queue: {parsed.eventingInfo}
            </Lozenge>
          )}
        </div>
      )}

      {/* ── 10. Generic fallback sections ── */}
      {parsed.genericSections.map((sec, sIdx) => {
        const text = sec.content.join('\n').trim();
        if (!text) return null;
        return (
          <div key={sIdx} style={{ fontSize: '13px', lineHeight: '20px', color: '#42526E' }}>
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
        backgroundColor: 'rgba(9, 30, 66, 0.54)',
        backdropFilter: 'blur(2px)',
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
          maxWidth: '860px',
          height: '100vh',
          backgroundColor: '#FFFFFF',
          boxShadow: '-8px 0 32px rgba(9, 30, 66, 0.16)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideInRight 0.2s cubic-bezier(0, 0, 0.2, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 1. Drawer Header (ADS Standard) ── */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #DFE1E6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '3px',
                backgroundColor: '#0052CC',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ChatSparkleIcon />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#172B4D',
                  margin: 0,
                  lineHeight: '24px',
                }}
              >
                Ask RepoDoctor
              </h2>
              <p
                style={{
                  fontSize: '12px',
                  color: '#6B778C',
                  margin: 0,
                  lineHeight: '16px',
                }}
              >
                Explain features, visual flows, and dependencies backed strictly by source code evidence
              </p>
            </div>
          </div>
          <Button
            appearance="subtle"
            spacing="compact"
            onClick={onClose}
            aria-label="Close Ask Drawer"
            style={{ color: '#42526E', padding: '4px' }}
          >
            <CloseIcon />
          </Button>
        </div>

        {/* ── 2. Question Composer Section (ADS Standard) ── */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#FAFBFC',
            borderBottom: '1px solid #DFE1E6',
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                data-testid="ask-question-input"
                placeholder="Ask how something works, blast radius, or cross-repo flows..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 80px 8px 12px',
                  height: '36px',
                  fontSize: '13px',
                  borderRadius: '3px',
                  border: '1px solid #DFE1E6',
                  backgroundColor: '#FFFFFF',
                  color: '#172B4D',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#4C9AFF';
                  e.currentTarget.style.boxShadow = '0 0 0 1px #4C9AFF';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#DFE1E6';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <div style={{ position: 'absolute', right: '4px', top: '2px', bottom: '2px', display: 'flex', alignItems: 'center' }}>
                <Button
                  type="submit"
                  data-testid="ask-question-btn"
                  appearance="primary"
                  spacing="compact"
                  disabled={isLoading || !query.trim()}
                  style={{ height: '30px' }}
                >
                  {isLoading ? 'Analyzing...' : 'Ask'}
                </Button>
              </div>
            </div>

            {/* Starter Suggestion Chips (ADS Tags) */}
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#6B778C',
                  marginBottom: '6px',
                }}
              >
                SUGGESTED QUESTIONS:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {STARTER_QUESTIONS.map((sq) => (
                  <button
                    key={sq}
                    type="button"
                    onClick={() => {
                      setQuery(sq);
                      void handleExecuteQuery(sq);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      fontWeight: 500,
                      borderRadius: '3px',
                      backgroundColor: 'rgba(9, 30, 66, 0.04)',
                      border: '1px solid #DFE1E6',
                      color: '#0052CC',
                      cursor: 'pointer',
                      textAlign: 'left',
                      lineHeight: '16px',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(9, 30, 66, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(9, 30, 66, 0.04)';
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
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '48px 16px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  margin: '0 auto 16px',
                  borderRadius: '50%',
                  border: '3px solid #DFE1E6',
                  borderTopColor: '#0052CC',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#172B4D', margin: '0 0 6px' }}>
                Analyzing System Architecture...
              </h3>
              <p style={{ fontSize: '13px', color: '#6B778C', margin: 0, maxWidth: '440px', marginInline: 'auto', lineHeight: '20px' }}>
                Tracing component calls, database operations, and evidence citations across repositories without hallucinations.
              </p>
            </div>
          )}

          {error && (
            <div
              style={{
                border: '1px solid #FFBDAD',
                borderLeft: '3px solid #DE350B',
                backgroundColor: '#FFEBE6',
                borderRadius: '3px',
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <h4 style={{ margin: 0, fontWeight: 600, color: '#BF2600', fontSize: '14px' }}>
                  Unable to Answer Question
                </h4>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#BF2600', lineHeight: '20px' }}>
                {error}
              </p>
              <Button
                appearance="default"
                spacing="compact"
                onClick={() => void handleExecuteQuery(query)}
              >
                ↻ Try Again
              </Button>
            </div>
          )}

          {!isLoading && !response && !error && (
            <div style={{ padding: '32px 16px' }}>
              <EmptyState
                header="Ask Anything About This Project"
                description="RepoDoctor correlates route handlers, business services, database operations, and message queues to explain how functionality actually flows through code."
              />
            </div>
          )}

          {!isLoading && response && (
            <div data-testid="ask-response-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* ── Status Bar & Action ── */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: '#FAFBFC',
                  border: '1px solid #DFE1E6',
                  borderRadius: '3px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Lozenge appearance={response.isInferred ? 'moved' : 'success'} isBold>
                    {response.isInferred ? 'Inferred Flow' : 'Verified Static Evidence'}
                  </Lozenge>

                  <span style={{ fontSize: '12px', color: '#6B778C' }}>
                    ({response.participatingComponents.length} components, {response.citations.length} code citations)
                  </span>
                </div>

                {/* One-Click "View Flow" Action (ADS Button) */}
                {response.flowSteps.length > 0 && onNavigateFlow && (
                  <Button appearance="primary" spacing="compact" onClick={handleViewFlow}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <GraphFlowIcon />
                      <span>View Flow in Architecture</span>
                    </span>
                  </Button>
                )}
              </div>

              {/* ── Structured Senior Briefing Viewer ── */}
              <BriefingAnswerViewer
                answer={response.answer}
                query={query}
                onNavigateFlow={handleViewFlow}
              />

              {/* ── Step-by-Step Flow Timeline (fallback if not in briefing) ── */}
              {response.flowSteps.length > 0 && !response.answer.includes('Step-by-Step Execution Journey') && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '3px',
                    backgroundColor: '#FAFBFC',
                    border: '1px solid #DFE1E6',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#172B4D', margin: 0 }}>
                      Step-by-Step Execution Flow
                    </h3>
                    {onNavigateFlow && (
                      <Button appearance="subtle" spacing="compact" onClick={handleViewFlow} style={{ color: '#0052CC' }}>
                        <span>Open interactive diagram →</span>
                      </Button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {response.flowSteps.map((step: FlowStepDto) => (
                      <div
                        key={step.stepNumber}
                        style={{
                          display: 'flex',
                          gap: '12px',
                          padding: '12px 14px',
                          borderRadius: '3px',
                          border: '1px solid #DFE1E6',
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: '#0052CC',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {step.stepNumber}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, fontSize: '13px', color: '#172B4D' }}>
                              {step.componentName}
                            </span>
                            {step.methodName && (
                              <>
                                <span style={{ color: '#0052CC', fontWeight: 700, fontSize: '12px' }}>→</span>
                                <span
                                  style={{
                                    fontFamily: 'SFMono-Medium, "Segoe UI Mono", Menlo, Consolas, monospace',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                    color: '#0052CC',
                                    backgroundColor: '#DEEBFF',
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                  }}
                                >
                                  {step.methodName}
                                </span>
                              </>
                            )}
                            <Lozenge appearance="default">
                              {step.componentType}
                            </Lozenge>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                color: '#6B778C',
                              }}
                            >
                              <RepoBranchIcon />
                              <span>{step.repositoryName}</span>
                            </span>
                            {step.edgeType && (
                              <Lozenge appearance="moved">
                                {step.edgeType}
                              </Lozenge>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: '13px', color: '#42526E', lineHeight: '20px' }}>
                            {step.description}
                          </p>
                          {step.targetName && (
                            <div style={{ marginTop: '6px', fontSize: '12px', color: '#0052CC', fontWeight: 600 }}>
                              ↳ Connects to: {step.targetName}
                              {step.targetMethodName && (
                                <span style={{ fontFamily: 'monospace', marginLeft: '4px', color: '#0052CC' }}>
                                  → {step.targetMethodName}
                                </span>
                              )}
                              {step.targetRepositoryName && step.targetRepositoryName !== step.repositoryName && (
                                <span style={{ marginLeft: '6px', color: '#FFAB00' }}>
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
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#6B778C',
                    marginBottom: '6px',
                  }}
                >
                  FOLLOW-UP QUESTIONS:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {getFollowUpSuggestions(response).map((fq, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setQuery(fq);
                        void handleExecuteQuery(fq);
                      }}
                      style={{
                        padding: '8px 12px',
                        fontSize: '13px',
                        fontWeight: 500,
                        borderRadius: '3px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #DFE1E6',
                        color: '#0052CC',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background-color 0.1s ease, border-color 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#FAFBFC';
                        e.currentTarget.style.borderColor = '#4C9AFF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#FFFFFF';
                        e.currentTarget.style.borderColor = '#DFE1E6';
                      }}
                    >
                      <span>{fq}</span>
                      <span style={{ fontSize: '12px', color: '#6B778C' }}>→</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Expandable Supporting Code Evidence Section ── */}
              <div
                style={{
                  borderRadius: '3px',
                  border: '1px solid #DFE1E6',
                  backgroundColor: '#FFFFFF',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    backgroundColor: showEvidenceDetails ? '#FAFBFC' : '#FFFFFF',
                    transition: 'background-color 0.1s ease',
                  }}
                  onClick={() => setShowEvidenceDetails(!showEvidenceDetails)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#172B4D' }}>
                      Supporting Code Evidence
                    </span>
                    <Badge appearance="default">{response.citations.length}</Badge>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6B778C', fontSize: '12px' }}>
                    <span>{showEvidenceDetails ? 'Hide' : 'Inspect Evidence'}</span>
                    <ChevronDownIcon isExpanded={showEvidenceDetails} />
                  </div>
                </div>

                {showEvidenceDetails && (
                  <div
                    style={{
                      padding: '14px',
                      borderTop: '1px solid #DFE1E6',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '12px', color: '#6B778C', lineHeight: '18px' }}>
                      This explanation is synthesized directly from verified AST declarations, route decorators, and dependency citations across {response.participatingRepositories.length} repository(s). No speculative code was synthesized.
                    </p>

                    {response.citations.map((cite: CodeLocationCitationDto, idx: number) => {
                      const isExpanded = expandedCitationIndex === idx;
                      return (
                        <div
                          key={idx}
                          style={{
                            borderRadius: '3px',
                            border: '1px solid #DFE1E6',
                            backgroundColor: '#FAFBFC',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              backgroundColor: isExpanded ? '#F4F5F7' : '#FAFBFC',
                            }}
                            onClick={() => setExpandedCitationIndex(isExpanded ? null : idx)}
                          >
                            <span
                              style={{
                                fontFamily: 'SFMono-Medium, "Segoe UI Mono", Menlo, Consolas, monospace',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#0052CC',
                              }}
                            >
                              {cite.filePath}:{cite.lineStart}-{cite.lineEnd}
                            </span>
                            <span style={{ fontSize: '11px', color: '#6B778C' }}>
                              {isExpanded ? 'Collapse' : 'View Code'}
                            </span>
                          </div>

                          {isExpanded && cite.codeSnippet && (
                            <pre
                              style={{
                                margin: 0,
                                padding: '10px 12px',
                                backgroundColor: '#FFFFFF',
                                borderTop: '1px solid #DFE1E6',
                                fontFamily: 'SFMono-Medium, "Segoe UI Mono", Menlo, Consolas, monospace',
                                fontSize: '12px',
                                overflowX: 'auto',
                                color: '#172B4D',
                                lineHeight: '18px',
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
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: '3px',
                          backgroundColor: '#FFFAE6',
                          border: '1px solid #FFE380',
                          borderLeft: '3px solid #FFAB00',
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#172B4D', marginBottom: '4px' }}>
                          Analysis Limitations:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#42526E', lineHeight: '18px' }}>
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
