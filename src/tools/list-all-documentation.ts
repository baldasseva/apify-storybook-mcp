import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Actor } from "apify";
import z from "zod";

import { buildComponentIndex, componentBaseIdFromTitle, fetchSharedStorybookIndex, resolvePublicUrlForEntry } from "../storybook_scraper.js";
import type { DocListEntry, StorybookIndex } from "../types.js";

const buildMdxOutput = (
    docs: DocListEntry[],
    index: StorybookIndex,
    components: DocListEntry[],
    input: { storybookBaseUrl: string }
): string => {
    const lines: string[] = [];
    lines.push('These are the available documentation files and components:');

    // Map docs by baseId for linking from components
    const docByBaseId = new Map<string, DocListEntry>();
    for (const d of docs) {
        const baseId = componentBaseIdFromTitle(d.title);
        docByBaseId.set(baseId, d);
    }

    // Docs bullets
    for (const d of docs) {
        const url = resolvePublicUrlForEntry(index.entries[d.id], input.storybookBaseUrl);
        const desc = '';
        lines.push(`- [${d.title}](${url}): ${desc}`.trimEnd());
    }

    // Components bullets (link to docs if available, else first story)
    for (const c of components) {
        const baseId = componentBaseIdFromTitle(c.title);
        let url = '';
        const maybeDoc = docByBaseId.get(baseId);
        if (maybeDoc) {
            url = resolvePublicUrlForEntry(index.entries[maybeDoc.id], input.storybookBaseUrl);
        } else {
            // find first story id in this component group
            const firstStoryId = buildComponentIndex(index)
                .find((ci) => ci.baseId === baseId)?.stories[0];
            if (firstStoryId) {
                const entry = index.entries[firstStoryId];
                url = resolvePublicUrlForEntry(entry, input.storybookBaseUrl);
            }
        }
        const desc = '';
        lines.push(`- [${c.title}](${url}): ${desc}`.trimEnd());
    }

    const mdx = lines.join('\n');
    return mdx;
}

export const CONFIG_SCHEMA = {
    description:
        'Lists all available UI components and standalone docs in the shared Storybook (live data from index.json).',
    inputSchema: {},
    outputSchema: {
        entries: z.array(
            z.object({
                id: z.string(),
                title: z.string(),
                kind: z.enum(['component', 'docs']),
                path: z.string(),
            }),
        ),
    },
};

export const CONFIG = async (): Promise<CallToolResult> => {
    await Actor.charge({ eventName: 'list-all-documentation' });
    const input = await Actor.getInput<{ storybookBaseUrl: string }>();
    if (!input?.storybookBaseUrl) {
        throw new Error('Missing required Actor input: storybookBaseUrl');
    }
    const index = await fetchSharedStorybookIndex(input.storybookBaseUrl);

    // Docs: include Storybook docs entries OR any entry with .mdx importPath
    const docsSet = new Map<string, DocListEntry>();
    for (const e of Object.values(index.entries)) {
        const isDocType = e.type === 'docs';
        const isMdx = e.importPath.toLowerCase().endsWith('.mdx');
        if (isDocType || isMdx) {
            docsSet.set(e.id, {
                id: e.id,
                title: e.title,
                kind: 'docs',
                path: e.importPath,
            });
        }
    }
    const docs = Array.from(docsSet.values());

    // Components: build unique components but exclude doc-only groups (all importPaths .mdx and no stories)
    const components = buildComponentIndex(index)
        .filter((c) => {
            const groupEntries = Object.values(index.entries).filter((e) => componentBaseIdFromTitle(e.title) === c.baseId);
            const hasNonMdxStory = groupEntries.some((e) => e.type === 'story' && !e.importPath.toLowerCase().endsWith('.mdx'));
            // A component should be listed only if there is at least one non-MDX story in the group
            return hasNonMdxStory;
        })
        .map<DocListEntry>((c) => ({
            id: c.baseId,
            title: c.title,
            kind: 'component',
            path: c.importPaths[0] ?? '',
        }));

    const entries: DocListEntry[] = [...components, ...docs];

    return {
        content: [
            { type: 'text', text: buildMdxOutput(docs, index, components, input) },
        ],
        structuredContent: { entries },
    };
};
