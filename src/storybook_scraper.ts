import { log } from 'apify';
import type { Frame, Page } from 'playwright';

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
 * Crawling functions
 *
 */

export async function openCodeExamples(frame: Frame) {
    const toggleButtons = await frame.$$('.docblock-code-toggle');
    for (const btn of toggleButtons) {
        await btn.click();
    }
}

export async function getStoryFrame(page: Page): Promise<Frame> {
    const frameElement = await page.$('iframe#storybook-preview-iframe');
    if (!frameElement) {
        throw new Error('Could not find Storybook preview iframe on the page');
    }
    const frame = await frameElement.contentFrame();
    if (!frame) {
        throw new Error('Could not get content frame from Storybook preview iframe');
    }
    return frame;
}

export async function scrapeDocsIframe(ctx: Frame): Promise<{ title: string; markdown: string }> {
    const container = await ctx.$('div.sb-unstyled');

    if (!container) {
        // Fallback
        const title = await (ctx.$eval('h1', (el: HTMLElement) => (el.textContent || '').trim()).catch(() => ''));
        const paragraphs = await (ctx.$$eval('p', (els: HTMLElement[]) => els.map(el => (el.textContent || '').trim()).filter(Boolean)).catch(() => []));
        const markdown = paragraphs.join('\n\n');
        return { title, markdown };
    }

    return await ctx.evaluate((el: Element) => {
        const lines: string[] = [];
        let title = '';
        const kids = Array.from(el.children);
        for (const child of kids) {
            const tag = child.tagName.toLowerCase();
            const classes = (child as HTMLElement).className || '';
            const text = (child.textContent || '').trim();
            if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
                const marks: Record<string, string> = { h1: '#', h2: '##', h3: '###', h4: '####', h5: '#####', h6: '######' };
                const line = `${marks[tag]} ${text}`;
                if (tag === 'h1' && !title) title = text;
                lines.push(line);
                continue;
            }
            if (tag === 'p') {
                lines.push(text);
                continue;
            }
            if (tag === 'ul') {
                const items = Array.from(child.children).filter(c => c.tagName.toLowerCase() === 'li');
                for (const li of items) lines.push(`- ${(li.textContent || '').trim()}`);
                continue;
            }
            if (tag === 'ol') {
                const items = Array.from(child.children).filter(c => c.tagName.toLowerCase() === 'li');
                items.forEach((li, i) => lines.push(`${i + 1}. ${(li.textContent || '').trim()}`));
                continue;
            }
            if (tag === 'table') {
                lines.push('**Props**');
                try {
                    const tbody = child.querySelector('tbody');
                    if (tbody) {
                        const rows = Array.from(tbody.querySelectorAll('tr'));
                        for (const row of rows) {
                            const cells = Array.from(row.querySelectorAll('td'));
                            if (cells.length < 4) {
                                // Unexpected structure, skip
                                continue;
                            }
                            const name = (cells[0].textContent || '').trim();
                            const desc = (cells[1].textContent || '').trim();
                            const defRaw = (cells[2].textContent || '').trim();
                            const hasDefault = defRaw && defRaw !== '-';
                            let optionsText = '';
                            const select = cells[3].querySelector('select');
                            if (select) {
                                const opts = Array.from(select.querySelectorAll('option')).map((o) => (o.textContent || '').trim()).filter(Boolean);
                                if (opts.length) optionsText = opts.join(' | ');
                            }
                            const parts: string[] = [];
                            parts.push(`${name}: ${desc}`);
                            if (hasDefault) parts.push(`default: ${defRaw}`);
                            if (optionsText) parts.push(`options: ${optionsText}`);
                            lines.push(`- ${parts.join(' — ')}`);
                        }
                    } else {
                        // No tbody found; leave a placeholder
                        lines.push('Props table detected, but no tbody found.');
                    }
                } catch {
                    lines.push('Props table detected, but failed to parse.');
                }
                continue;
            }
            if (tag === 'div') {
                const isStoryPreview = classes.includes('sbdocs') && classes.includes('sbdocs-preview');
                if (isStoryPreview) {
                    const pre = child.querySelector('pre');
                    const code = pre ? (pre.textContent || '').trim() : '';
                    if (code) {
                        lines.push('```tsx');
                        lines.push(code);
                        lines.push('```');
                    }
                    continue;
                }
                if (text) lines.push(text);
                continue;
            }
            if (text) lines.push(text);
        }
        const markdown = lines.join('\n\n');
        return { title, markdown };
    }, container);
}
