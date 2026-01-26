export type StoryUrlRequest = {
    absoluteStoryPath: string;
    exportName: string;
    explicitStoryName?: string;
};

export type StoryUrlResult = StoryUrlRequest & {
    url: string;
};

export type DocListEntry = {
    id: string;
    title: string;
    kind: 'component' | 'docs';
    path: string;
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

// Storybook index.json types
export type StorybookIndex = {
    v: number;
    entries: Record<string, StorybookEntry>;
};

export type StorybookBaseEntry = {
    id: string;
    title: string; // e.g. "Design Tokens/Icons"
    importPath: string; // source file path used by Storybook build
    tags?: string[];
};

export type StorybookDocEntry = StorybookBaseEntry & {
    type: 'docs';
    name: string; // usually "Docs"
    storiesImports?: string[];
};

export type StorybookStoryEntry = StorybookBaseEntry & {
    type: 'story';
    subtype?: 'story' | 'docs';
    name: string; // story display name, e.g. "Default"
    exportName?: string; // named export from CSF3 file
};

export type StorybookEntry = StorybookDocEntry | StorybookStoryEntry;

// Derived component index type (unique components deduped from titles)
export type ComponentIndexEntry = {
    baseId: string; // derived from title hierarchy in dash-case
    title: string; // original grouped title
    importPaths: string[]; // all distinct import paths involved
    hasDocs: boolean;
    stories: string[]; // list of story IDs belonging to this component
};
