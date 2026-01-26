/* eslint-disable */
import type { DocListEntry } from '../types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// Mock apify Actor API
jest.mock('apify', () => ({
  Actor: {
    charge: jest.fn(async () => { /* noop */ }),
    getInput: jest.fn(async () => ({ storybookBaseUrl: 'https://example.com/storybook/' })),
  },
}));

// Sample index with:
// - a normal docs entry (mdx)
// - a normal component story (tsx)
// - a misclassified MDX story that should still be treated as docs, not component
const sampleIndex = {
  v: 5,
  entries: {
    'intro--docs': {
      id: 'intro--docs',
      title: 'Intro',
      name: 'Docs',
      importPath: './src/Intro.mdx',
      storiesImports: [],
      type: 'docs',
      tags: ['dev'],
    },
    'ui-library-code-codeblockwithtabs--default': {
      type: 'story',
      subtype: 'story',
      id: 'ui-library-code-codeblockwithtabs--default',
      name: 'Default',
      title: 'UI-Library/Code/CodeBlockWithTabs',
      importPath: '../ui-library/src/code/CodeBlockWithTabs.stories.tsx',
      tags: ['dev'],
      exportName: 'Default',
    },
    'mdx-only-group--default': {
      type: 'story',
      subtype: 'story',
      id: 'mdx-only-group--default',
      name: 'Default',
      title: 'MDX Only Group',
      importPath: './src/OnlyDoc.mdx',
      tags: ['dev'],
      exportName: 'Default',
    },
  },
} as const;

// Mock only the fetchSharedStorybookIndex; use real implementations for others
jest.mock('../storybook_scraper.js', () => {
  const actual = jest.requireActual('../storybook_scraper.js');
  return {
    ...actual,
    fetchSharedStorybookIndex: jest.fn(async () => sampleIndex),
  };
});

// Import the tool after mocks are set up
import { CONFIG } from '../tools/list-all-documentation.js';

function getTextContent(result: CallToolResult): string {
  const part = result.content.find((c: { type?: string }) => c.type === 'text') as { type: 'text'; text: string } | undefined;
  return part?.text ?? '';
}

describe('list-all-documentation tool', () => {
  it('returns MDX content with links and classifies .mdx entries as docs', async () => {
    const res = (await CONFIG()) as CallToolResult;

    // MDX text checks
    const mdx = getTextContent(res);
    expect(mdx).toContain('These are the available documentation files and components:');
    expect(mdx).toContain('- [Intro](https://example.com/storybook/?path=/docs/intro--docs)');
    // Component link should reference the non-MDX story group title
    expect(mdx).toContain('- [UI-Library/Code/CodeBlockWithTabs](');

    // Structured entries checks
    const { entries } = res.structuredContent as { entries: DocListEntry[] };

    const docsIds = entries.filter((e) => e.kind === 'docs').map((e) => e.id);
    const componentIds = entries.filter((e) => e.kind === 'component').map((e) => e.id);

    // MDX files must be classified as docs
    expect(docsIds).toContain('intro--docs');
    expect(docsIds).toContain('mdx-only-group--default');

    // The MDX-only group should not appear as a component
    // Only the non-MDX component baseId should be present
    expect(componentIds).toContain('ui-library-code-codeblockwithtabs');
    expect(componentIds).not.toContain('mdx-only-group');
  });
});
