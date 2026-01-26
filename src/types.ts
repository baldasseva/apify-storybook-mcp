export type StoryUrlRequest = {
    absoluteStoryPath: string;
    exportName: string;
    explicitStoryName?: string;
};

export type StoryUrlResult = StoryUrlRequest & {
    url: string;
};

export type DocDetail = {
    id: string;
    title: string;
    summary: string;
    markdown: string;
    metadata: {
        kind: 'component' | 'docs';
        path: string;
    };
};

export type StorybookIndex = {
    v: number;
    entries: Record<string, StorybookEntry>;
};

export type StorybookBaseEntry = {
    id: string;
    title: string;
    importPath: string;
    tags?: string[];
};

export type StorybookDocEntry = StorybookBaseEntry & {
    type: 'docs';
    name: string;
    storiesImports?: string[];
};

export type StorybookStoryEntry = StorybookBaseEntry & {
    type: 'story';
    subtype?: 'story' | 'docs';
    name: string;
    exportName?: string;
    componentPath?: string;
};

export type StorybookEntry = StorybookDocEntry | StorybookStoryEntry;

export type ComponentEntry = {
    id: string;
    title: string;
    importPath: string;
    componentPath?: string;
    tags: string[];
};
