import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '../components/atlassian/Button';
import { Lozenge } from '../components/atlassian/Lozenge';
import { Badge } from '../components/atlassian/Badge';
import { Avatar } from '../components/atlassian/Avatar';
import { EmptyState } from '../components/atlassian/EmptyState';
import { AskRepoDoctorDrawer } from '../components/AskRepoDoctorDrawer';
import type { AskRepoDoctorResponseDto } from '@repo-doctor/shared';

describe('Atlassian Design System (ADS) Component Library', () => {
  describe('Button component', () => {
    it('renders with ADS primary appearance (#0052cc)', () => {
      const html = renderToStaticMarkup(
        React.createElement(Button, { appearance: 'primary' }, 'Primary Action')
      );
      expect(html).toContain('Primary Action');
      expect(html).toContain('background-color:#0052cc');
      expect(html).toContain('border-radius:3px');
    });

    it('renders with ADS default appearance and 32px height', () => {
      const html = renderToStaticMarkup(
        React.createElement(Button, { appearance: 'default' }, 'Default Button')
      );
      expect(html).toContain('Default Button');
      expect(html).toContain('height:32px');
      expect(html).toContain('border-radius:3px');
    });

    it('renders as a Next.js Link when href is provided', () => {
      const html = renderToStaticMarkup(
        React.createElement(Button, { href: '/login', appearance: 'subtle' }, 'Log in')
      );
      expect(html).toContain('href="/login"');
      expect(html).toContain('Log in');
    });
  });

  describe('Lozenge component', () => {
    it('renders subtle success lozenge with ADS tokens (#e3fcef bg, #006644 text)', () => {
      const html = renderToStaticMarkup(
        React.createElement(Lozenge, { appearance: 'success' }, 'Connected')
      );
      expect(html).toContain('Connected');
      expect(html).toContain('background-color:#E3FCEF');
      expect(html).toContain('color:#006644');
      expect(html).toContain('text-transform:uppercase');
      expect(html).toContain('border-radius:3px');
    });

    it('renders bold inprogress lozenge with ADS tokens (#0052cc bg, #ffffff text)', () => {
      const html = renderToStaticMarkup(
        React.createElement(Lozenge, { appearance: 'inprogress', isBold: true }, 'In Progress')
      );
      expect(html).toContain('In Progress');
      expect(html).toContain('background-color:#0052CC');
      expect(html).toContain('color:#FFFFFF');
    });
  });

  describe('Badge component', () => {
    it('renders numeric badge with pill border-radius and default tokens', () => {
      const html = renderToStaticMarkup(
        React.createElement(Badge, { appearance: 'default' }, 5)
      );
      expect(html).toContain('5');
      expect(html).toContain('border-radius:10px');
      expect(html).toContain('background-color:#DFE1E6');
      expect(html).toContain('color:#172B4D');
    });

    it('renders max value truncation (e.g. 99+)', () => {
      const html = renderToStaticMarkup(
        React.createElement(Badge, { max: 99 }, 150)
      );
      expect(html).toContain('99+');
    });
  });

  describe('Avatar component', () => {
    it('renders initials with Atlassian circular styling and blue accent', () => {
      const html = renderToStaticMarkup(
        React.createElement(Avatar, { name: 'Divyanshi Bansal', size: 'medium' })
      );
      expect(html).toContain('DB');
      expect(html).toContain('width:32px');
      expect(html).toContain('border-radius:50%');
      expect(html).toContain('background-color:#deebff');
      expect(html).toContain('color:#0747a6');
    });
  });

  describe('EmptyState component', () => {
    it('renders clean Atlassian Empty State with heading, description and action', () => {
      const onAction = vi.fn();
      const html = renderToStaticMarkup(
        React.createElement(EmptyState, {
          testId: 'test-empty-state',
          header: 'No Repositories Linked to this Project',
          description: 'Link repositories to explore architecture.',
          primaryAction: React.createElement(Button, { appearance: 'primary', onClick: onAction }, 'Link Repositories'),
        })
      );
      expect(html).toContain('data-testid="test-empty-state"');
      expect(html).toContain('No Repositories Linked to this Project');
      expect(html).toContain('Link repositories to explore architecture.');
      expect(html).toContain('Link Repositories');
      expect(html).toContain('border-radius:3px');
      expect(html).toContain('border:1px solid #dfe1e6');
    });
  });

  describe('AskRepoDoctorDrawer (ADS Implementation)', () => {
    it('renders drawer with ADS 3px tags, ADS button, and ADS empty state', () => {
      const html = renderToStaticMarkup(
        React.createElement(AskRepoDoctorDrawer, {
          isOpen: true,
          onClose: vi.fn(),
          projectId: 'p1',
          onQueryProject: vi.fn(),
        })
      );

      // Verify drawer container and test IDs
      expect(html).toContain('data-testid="ask-repodoctor-drawer"');
      expect(html).toContain('data-testid="ask-question-input"');
      expect(html).toContain('data-testid="ask-question-btn"');

      // Verify Atlassian 3px corners on input and question tags
      expect(html).toContain('border-radius:3px');
      // No 9999px pill shapes on suggested questions
      expect(html).not.toContain('border-radius:9999px');

      // Verify ADS palette tokens
      expect(html).toContain('#0052CC');
      expect(html).toContain('#172B4D');
      expect(html).toContain('#DFE1E6');

      // Verify ADS EmptyState in initial state
      expect(html).toContain('Ask Anything About This Project');
    });
  });
});
