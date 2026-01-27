import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Actor } from "apify";
import { PlaywrightCrawler } from "crawlee";
import z from "zod";

import { getStoryDocContainer, openCodeExamples, scrapeDocsIframe } from "../storybook_scraper.js";
import type { DocDetail } from "../types.js";

export const EVENT_NAME = 'get-component-documentation';

export const CONFIG_SCHEMA = {
    description:
        'Returns detailed documentation for a specific component or docs entry by ID (dummy data).',
    inputSchema: {
        id: z.string().describe('Component/docs ID to retrieve'),
    },
    outputSchema: {
        markdown: z.string(),
    },
};

export const CONFIG = async ({ id }: { id: string }): Promise<CallToolResult> => {
    await Actor.charge({ eventName: EVENT_NAME });
    const input = await Actor.getInput<{ storybookBaseUrl: string }>();
    const base = (input?.storybookBaseUrl ?? '').trim();
    if (!base) throw new Error('Missing required Actor input: storybookBaseUrl');

    const docsUrl = `${base}?path=/docs/${id}--docs`;

    let scraped: DocDetail | undefined;
    const crawler = new PlaywrightCrawler({
        maxRequestsPerCrawl: 1,
        maxConcurrency: 1,
        requestHandler: async ({ page }) => {
            await page.goto(docsUrl, { waitUntil: 'domcontentloaded' });

            const container = await getStoryDocContainer(page);
            await openCodeExamples(container);
            const { title, markdown } = await scrapeDocsIframe(container);

            scraped = {
                id,
                title: title || id,
                markdown,
                metadata: { path: docsUrl },
            };
        },
    });

    await crawler.run([{ url: docsUrl }]);

    const doc = scraped!;
    const result = doc?.markdown;
    return {
        content: [{ type: 'text', text: result }],
        structuredContent: doc,
    };
};
