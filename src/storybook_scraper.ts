import { log } from 'apify';
import { sleep } from 'crawlee';
import type { Locator, Page } from 'playwright';

import type { StorybookIndex } from './types.js';

function normalizeBaseUrl(baseUrl: string): string {
    const trimmed = baseUrl.trim();
    if (!trimmed) throw new Error('storybookBaseUrl is empty');
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

/** Fetch and parse the shared Storybook index.json */
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

/**
 *
 * Playwright crawling functions
 *
 */

export async function openCodeExamples(container: Locator) {
    // Only click toggles that are not already expanded
    const toggleButtons = await container.locator('.docblock-code-toggle:not(.docblock-code-toggle--expanded)').elementHandles();
    for (const btn of toggleButtons) {
        await btn.click();
        await sleep(250); // small delay to allow code block to render
    }
}

export async function getStoryDocContainer(page: Page): Promise<Locator> {
    // There may be different nesting levels depending on Storybook version and layout
    // so we use look for H1 presence in order to find the father container of all the doc elements
    const base = '#storybook-docs div.sbdocs div.sbdocs';
    const depthSelectors = [
        base,
        `${base} > div`,
        `${base} > div > div`,
    ];
    await page.waitForSelector(base);
    // Wait for the base container to appear
    await page.locator(base).first().waitFor();

    for (const sel of depthSelectors) {
        const candidate = page.locator(sel).first();
        // Check for an H1 child inside the candidate
        if (await candidate.locator('> h1').count()) {
            return candidate;
        }
    }

    // Fallback to original container if none matched the H1 heuristic
    const fallback = page.locator(base).first();
    await fallback.waitFor();
    return fallback;
}

export async function scrapeDocsIframe(container: Locator): Promise<{ title: string; markdown: string }> {
    const lines: string[] = [];
    let title = '';

    // Iterate top-level children to preserve order and structure
    const children = await container.locator(':scope > *').elementHandles();

    for (const child of children) {
        const tagNameHandle = await child.getProperty('tagName');
        const tag = String((await tagNameHandle.jsonValue()) || '').toLowerCase();
        const text = ((await child.textContent()) || '').trim();

        switch (tag) {
            case 'h1':
                if (!title) title = text;
                lines.push(`# ${text}`);
                break;
            case 'h2':
                lines.push(`## ${text}`);
                break;
            case 'h3':
                lines.push(`### ${text}`);
                break;
            case 'h4':
                lines.push(`#### ${text}`);
                break;
            case 'h5':
                lines.push(`##### ${text}`);
                break;
            case 'h6':
                lines.push(`###### ${text}`);
                break;
            case 'ul': {
                const items = await child.$$('li');
                for (const li of items) {
                    const liText = ((await li.textContent()) || '').trim();
                    if (liText) lines.push(`- ${liText}`);
                }
                break;
            }
            case 'ol': {
                const items = await child.$$('li');
                for (let i = 0; i < items.length; i++) {
                    const liText = ((await items[i].textContent()) || '').trim();
                    if (liText) lines.push(`${i + 1}. ${liText}`);
                }
                break;
            }
            case 'div': {
                // Check for story preview with code block
                const pre = await child.$('pre');
                if (pre) {
                    const storyTitle = await child.$('h3');
                    const code = ((await pre.textContent()) || '').trim();
                    if (code) {
                        if (storyTitle) {
                            const stText = ((await storyTitle.textContent()) || '').trim();
                            if (stText) lines.push(`#### ${stText}`);
                        }
                        lines.push('```tsx');
                        lines.push(code);
                        lines.push('```');
                    }
                    break;
                }

                // Check for props table
                const table = await child.$('table');
                if (table) {
                    lines.push('**Props**');
                    const tbody = await table.$('tbody');
                    if (tbody) {
                        const rows = await tbody.$$('tr');
                        for (const row of rows) {
                            const cells = await row.$$('td');
                            if (cells.length < 4) continue; // Unexpected structure

                            const name = ((await cells[0].textContent()) || '').trim();
                            const desc = ((await cells[1].textContent()) || '').trim();
                            const defRaw = ((await cells[2].textContent()) || '').trim();
                            const hasDefault = !!defRaw && defRaw !== '-';

                            let optionsText = '';
                            const select = await cells[3].$('select');
                            if (select) {
                                const opts = await select.$$('option');
                                const optTexts: string[] = [];
                                for (const o of opts) {
                                    const t = ((await o.textContent()) || '').trim();
                                    if (t && t !== 'Choose option...') optTexts.push(t);
                                }
                                if (optTexts.length) optionsText = optTexts.join(' | ');
                            }

                            const parts: string[] = [];
                            parts.push(`${name}: ${desc}`);
                            if (hasDefault) parts.push(`default: ${defRaw}`);
                            if (optionsText) parts.push(`options: ${optionsText}`);
                            lines.push(`- ${parts.join(' — ')}`);
                        }
                    }
                    break;
                }

                // Otherwise, include plain text if present
                if (text) lines.push(text);
                break;
            }
            case 'style':
            case 'script':
                // ignore
                break;
            default:
                if (text) lines.push(text);
                break;
        }
    }

    const markdown = lines.join('\n\n');
    return { title, markdown };
}
