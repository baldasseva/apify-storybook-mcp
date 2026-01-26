import { log } from 'apify';

import type {
    ComponentIndexEntry,
    StorybookDocEntry,
    StorybookEntry,
    StorybookIndex,
    StorybookStoryEntry,
} from './types.js';

function normalizeBaseUrl(baseUrl: string): string {
    const trimmed = baseUrl.trim();
    if (!trimmed) throw new Error('storybookBaseUrl is empty');
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

// Fetch and parse the shared Storybook index.json
export async function fetchSharedStorybookIndex(storybookBaseUrl: string): Promise<StorybookIndex> {
    const base = normalizeBaseUrl(storybookBaseUrl);
    const indexUrl = `${base}index.json`;
    log.info(`Fetching Storybook index.json from ${indexUrl}`);
    const res = await fetch(indexUrl, { method: 'GET' });
    if (!res.ok) {
        const msg = `Failed to fetch index.json (${indexUrl}): ${res.status} ${res.statusText}`;
        log.error(msg);
        throw new Error(msg);
    }
    const json = (await res.json()) as StorybookIndex;
    log.debug(`Fetched Storybook index v=${json.v} with ${Object.keys(json.entries).length} entries`);
    return json;
}

export function listDocs(index: StorybookIndex): StorybookDocEntry[] {
    return Object.values(index.entries).filter((e) => e.type === 'docs') as StorybookDocEntry[];
}

export function listStories(index: StorybookIndex): StorybookStoryEntry[] {
    return Object.values(index.entries).filter((e) => e.type === 'story') as StorybookStoryEntry[];
}

// Normalize a single title segment to dash-case without splitting camelCase
function normalizeSegment(segment: string): string {
    return segment
        .trim()
        .replace(/\s+/g, '-')
        .replace(/_/g, '-')
        .toLowerCase();
}

// Convert a Storybook grouped title (e.g., "UI-Library/Code/CodeBlockWithTabs")
// into the base component ID (e.g., "ui-library-code-codeblockwithtabs")
export function componentBaseIdFromTitle(title: string): string {
    return title.split('/').map(normalizeSegment).join('-');
}

// Build unique component index from all entries
export function buildComponentIndex(index: StorybookIndex): ComponentIndexEntry[] {
    const map = new Map<string, ComponentIndexEntry>();
    for (const entry of Object.values(index.entries)) {
        const baseId = componentBaseIdFromTitle(entry.title);
        const existing = map.get(baseId);
        const importPaths = new Set<string>(existing?.importPaths ?? []);
        importPaths.add(entry.importPath);

        const stories = new Set<string>(existing?.stories ?? []);
        if (entry.type === 'story') stories.add(entry.id);

        map.set(baseId, {
            baseId,
            title: entry.title,
            importPaths: Array.from(importPaths),
            hasDocs: Boolean(existing?.hasDocs) || entry.type === 'docs',
            stories: Array.from(stories),
        });
    }
    return Array.from(map.values());
}

// Resolve a public Storybook URL for a given entry
export function resolvePublicUrlForEntry(entry: StorybookEntry, storybookBaseUrl: string): string {
    const base = normalizeBaseUrl(storybookBaseUrl);
    const prefix = entry.type === 'docs' ? 'docs' : 'story';
    return `${base}?path=/${prefix}/${entry.id}`;
}

// Convenience: get entry by ID
export function getEntryById(index: StorybookIndex, id: string): StorybookEntry | undefined {
    return index.entries[id];
}
