import {
  buildComponentIndex,
  componentBaseIdFromTitle,
  fetchSharedStorybookIndex,
  getEntryById,
  listDocs,
  listStories,
  resolvePublicUrlForEntry,
} from '../storybook_scraper.js';
import type { StorybookEntry,StorybookIndex } from '../types.js';

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

  it('componentBaseIdFromTitle converts segmented titles to dash-case', () => {
    expect(componentBaseIdFromTitle('UI-Library/Code/CodeBlockWithTabs')).toBe(
      'ui-library-code-codeblockwithtabs',
    );
    expect(componentBaseIdFromTitle('Design Tokens/Icons')).toBe('design-tokens-icons');
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

  it('listDocs returns only docs entries', () => {
    const docs = listDocs(sampleIndex);
    expect(docs.map((d) => d.id)).toEqual(['intro--docs', 'design-tokens-icons--docs']);
  });

  it('listStories returns only story entries', () => {
    const stories = listStories(sampleIndex);
    expect(stories.map((s) => s.id)).toEqual(['ui-library-code-codeblockwithtabs--default']);
  });

  it('buildComponentIndex aggregates import paths, stories, and hasDocs flag', () => {
    const comps = buildComponentIndex(sampleIndex);
    const codeBlock = comps.find((c) => c.baseId === 'ui-library-code-codeblockwithtabs');
    expect(codeBlock).toBeTruthy();
    expect(codeBlock!.stories).toContain('ui-library-code-codeblockwithtabs--default');
    const designTokens = comps.find((c) => c.baseId === 'design-tokens-icons');
    expect(designTokens).toBeTruthy();
    expect(designTokens!.hasDocs).toBe(true);
  });

  it('resolvePublicUrlForEntry builds proper docs/story URLs', () => {
    const entryDoc = sampleIndex.entries['intro--docs'] as StorybookEntry;
    const entryStory = sampleIndex.entries['ui-library-code-codeblockwithtabs--default'] as StorybookEntry;
    expect(resolvePublicUrlForEntry(entryDoc, 'https://example.com/storybook/')).toBe(
      'https://example.com/storybook/?path=/docs/intro--docs',
    );
    expect(resolvePublicUrlForEntry(entryStory, 'https://example.com/storybook/')).toBe(
      'https://example.com/storybook/?path=/story/ui-library-code-codeblockwithtabs--default',
    );
  });

  it('getEntryById finds entries safely', () => {
    expect(getEntryById(sampleIndex, 'intro--docs')!.title).toBe('Intro');
    expect(getEntryById(sampleIndex, 'missing')).toBeUndefined();
  });
});
