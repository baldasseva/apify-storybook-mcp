import { fetchSharedStorybookIndex } from '../storybook_scraper.js';
import type { StorybookIndex } from '../types.js';

describe('storybook_scraper', () => {
  const sampleIndex: StorybookIndex = {
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
      'design-tokens-icons--docs': {
        id: 'design-tokens-icons--docs',
        title: 'Design Tokens/Icons',
        name: 'Docs',
        importPath: '../ui-icons/src/icongraphy.mdx',
        type: 'docs',
        tags: ['dev'],
        storiesImports: [],
      },
    },
  };

  beforeEach(() => {
    // Mock global fetch for index.json retrieval
    global.fetch = (jest.fn(async (url: string | URL) => {
      if (url.toString().endsWith('/index.json')) {
        const resp: { ok: boolean; json: () => Promise<StorybookIndex>; status: number; statusText: string } = {
          ok: true,
          json: async () => sampleIndex,
          status: 200,
          statusText: 'OK',
        };
        return resp as unknown as Response;
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as unknown) as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetchSharedStorybookIndex appends index.json and normalizes base URL', async () => {
    await expect(fetchSharedStorybookIndex('https://example.com/storybook')).resolves.toEqual(
      sampleIndex,
    );
    await expect(fetchSharedStorybookIndex('https://example.com/storybook/')).resolves.toEqual(
      sampleIndex,
    );
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      'https://example.com/storybook/index.json',
    );
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe(
      'https://example.com/storybook/index.json',
    );
  });

  // Other scraper helpers have been removed; keep coverage for index fetching only
});
