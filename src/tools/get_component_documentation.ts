import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Actor } from "apify";
import z from "zod";

import type { DocDetail } from "../types.js";

export const EVENT_NAME = 'get-component-documentation';

export const CONFIG_SCHEMA = {
    description:
        'Returns detailed documentation for a specific component or docs entry by ID (dummy data).',
    inputSchema: {
        id: z.string().describe('Component/docs ID to retrieve'),
    },
    outputSchema: {
        doc: z.object({
            id: z.string(),
            title: z.string(),
            summary: z.string(),
            markdown: z.string(),
            metadata: z.object({
                kind: z.enum(['component', 'docs']),
                path: z.string(),
            }),
        }),
    },
};

export const CONFIG = async ({ id }: { id: string }): Promise<CallToolResult> => {
    await Actor.charge({ eventName: EVENT_NAME });
    const doc: DocDetail = {
        id,
        title: id === 'button' ? 'Button' : 'Documentation',
        summary: 'This is a placeholder summary for the requested entry.',
        markdown: '# Heading\n\nThis is dummy markdown content for the entry.',
        metadata: {
            kind: id === 'button' ? 'component' : 'docs',
            path: id === 'button' ? 'components/button' : `docs/${id}`,
        },
    };

    return {
        content: [
            { type: 'text', text: `Returned documentation for '${id}' (dummy).` },
        ],
        structuredContent: { doc },
    };
};
