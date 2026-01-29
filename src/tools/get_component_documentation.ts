import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Actor, log } from "apify";
import { PlaywrightCrawler } from "crawlee";
import z from "zod";

import { getStoryDocContainer, openCodeExamples, scrapeDocsIframe } from "../storybook_scraper.js";
import type { DocDetail } from "../types.js";

export const EVENT_NAME = 'get-component-documentation';

export const CONFIG_SCHEMA = {
    description:
        'Returns detailed documentation for a specific component or docs entry by ID.',
    inputSchema: {
        id: z.string().describe('Component/docs ID to retrieve'),
    },
    outputSchema: {
        id: z.string(),
        title: z.string(),
        markdown: z.string(),
        metadata: z.object({
            path: z.string(),
        }),
    },
};

const getDocsUrl = (base: string, id: string) => `${base.trim()}iframe.html?viewMode=docs&id=${id}--docs`;

const getEmptyDocResponse = (id: string, docsUrl: string): DocDetail => ( {
    id,
    title: id,
    markdown: 'Documentation not found',
    metadata: {path: docsUrl},
});

export const CONFIG = async ({ id }: { id: string }, storybookBaseUrl: string): Promise<CallToolResult> => {
    await Actor.charge({ eventName: EVENT_NAME });

    const docsUrl = getDocsUrl(storybookBaseUrl, id);

    let scraped: DocDetail | undefined;

    const crawler = new PlaywrightCrawler({
        maxRequestsPerCrawl: 100,
        maxConcurrency: 5,
        requestHandler: async ({ page }) => {
            try {
                const res = await page.goto(docsUrl, { waitUntil: 'domcontentloaded' });

                if (!res || !res.ok()) {
                    scraped = getEmptyDocResponse(id, docsUrl);
                    return;
                }

                const container = await getStoryDocContainer(page);
                await openCodeExamples(container);
                const { title, markdown } = await scrapeDocsIframe(container);

                scraped = {
                    id,
                    title: title || id,
                    markdown,
                    metadata: { path: docsUrl },
                };

            } catch (err) {
                log.error(`Error navigating to docs URL for ID=${id} at ${docsUrl}: ${(err as Error).message}`);
                scraped = getEmptyDocResponse(id, docsUrl);
            }
        },
    });

    await crawler.run([{ url: docsUrl }]);

    const doc = scraped ?? getEmptyDocResponse(id, docsUrl);
    const result = doc.markdown;
    return {
        content: [{ type: 'text', text: result }],
        structuredContent: doc,
    };
};
