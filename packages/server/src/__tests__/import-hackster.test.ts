import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hacksterHandler } from '../import/platforms/hackster';

describe('hackster.io platform handler', () => {
  describe('match', () => {
    it('should match www.hackster.io', () => {
      expect(hacksterHandler.match(new URL('https://www.hackster.io/user/project'))).toBe(true);
    });

    it('should match hackster.io without www', () => {
      expect(hacksterHandler.match(new URL('https://hackster.io/user/project'))).toBe(true);
    });

    it('should not match other domains', () => {
      expect(hacksterHandler.match(new URL('https://medium.com/article'))).toBe(false);
      expect(hacksterHandler.match(new URL('https://dev.to/post'))).toBe(false);
      expect(hacksterHandler.match(new URL('https://example.com'))).toBe(false);
    });
  });

  describe('import', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      // Mock Algolia requests
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('algolia')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              hits: [{
                name: 'LED Weather Station',
                slug: 'led-weather-station',
                pitch: 'A connected weather display using NeoPixels',
                cover_image_url: 'https://hackster.imgix.net/uploads/cover.jpg',
                difficulty: 'intermediate',
                platforms: [{ id: 1, name: 'Arduino' }, { id: 2, name: 'Raspberry Pi' }],
                programming_languages: [{ id: 3, name: 'C++' }, { id: 4, name: 'Python' }],
                parts: [
                  { full_name: 'Arduino Uno Rev3', name: 'Arduino Uno' },
                  { full_name: 'WS2812B LED Strip', name: 'NeoPixel' },
                ],
              }],
            }),
          });
        }
        return originalFetch(url);
      });
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    function buildHacksterHtml(options: {
      title?: string;
      story?: string;
      parts?: string;
      tools?: string;
    } = {}): string {
      const storyContent = options.story || `
        <h2>Introduction</h2>
        <p>This project shows how to build a connected weather station using Arduino and NeoPixel LEDs that changes color based on temperature readings.</p>
        <h2>Step 1: Wiring</h2>
        <p>Connect the NeoPixel data pin to Arduino pin 6. Add a 470 ohm resistor between the data line and the LED strip input.</p>
        <h2>Step 2: Programming</h2>
        <pre><code class="language-cpp">
#include &lt;Adafruit_NeoPixel.h&gt;
#define PIN 6
Adafruit_NeoPixel strip(30, PIN, NEO_GRB);
        </code></pre>
        <p>Upload the code and watch the LEDs respond to temperature changes in real time.</p>
      `;

      const partsSection = options.parts || `
        <ul>
          <li>Arduino Uno ×1</li>
          <li>WS2812B LED Strip ×2</li>
          <li>DHT22 Sensor ×1</li>
        </ul>
      `;

      return `<!DOCTYPE html>
        <html>
        <head>
          <title>${options.title || 'LED Weather Station'} | Hackster.io</title>
          <meta property="og:title" content="${options.title || 'LED Weather Station'}" />
          <meta property="og:description" content="A connected weather display" />
          <meta property="og:image" content="https://hackster.imgix.net/uploads/cover.jpg" />
        </head>
        <body>
          <h1>${options.title || 'LED Weather Station'}</h1>
          <div itemprop="text">${storyContent}</div>
          <div class="project-things">${partsSection}</div>
          ${options.tools ? `<div class="project-tools">${options.tools}</div>` : ''}
        </body>
        </html>`;
    }

    it('should extract story content from itemprop="text"', async () => {
      const html = buildHacksterHtml();
      const url = new URL('https://www.hackster.io/maker/led-weather-station');

      const result = await hacksterHandler.import(url, html);

      expect(result.partial).toBe(false);
      expect(result.content.length).toBeGreaterThan(0);

      // Should contain heading blocks
      const headings = result.content.filter(([type]) => type === 'heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('should extract parts list as a partsList block', async () => {
      const html = buildHacksterHtml();
      const url = new URL('https://www.hackster.io/maker/led-weather-station');

      const result = await hacksterHandler.import(url, html);

      const partsBlock = result.content.find(([type]) => type === 'partsList');
      expect(partsBlock).toBeDefined();
      if (partsBlock) {
        const parts = (partsBlock[1] as { parts: Array<{ name: string; qty: number }> }).parts;
        expect(parts.length).toBe(3);
        expect(parts[0].name).toBe('Arduino Uno');
        expect(parts[1].qty).toBe(2);
      }
    });

    it('should use Algolia data for metadata', async () => {
      const html = buildHacksterHtml();
      const url = new URL('https://www.hackster.io/maker/led-weather-station');

      const result = await hacksterHandler.import(url, html);

      expect(result.title).toBe('LED Weather Station');
      expect(result.description).toBe('A connected weather display using NeoPixels');
      expect(result.coverImageUrl).toBe('https://hackster.imgix.net/uploads/cover.jpg');
      expect(result.meta.difficulty).toBe('intermediate');
      expect(result.tags).toContain('Arduino');
      expect(result.tags).toContain('Python');
    });

    it('should fall back to HTML data when Algolia fails', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const html = buildHacksterHtml({ title: 'Fallback Project' });
      const url = new URL('https://www.hackster.io/maker/fallback-project');

      const result = await hacksterHandler.import(url, html);

      expect(result.title).toBe('Fallback Project');
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should extract tools section', async () => {
      const html = buildHacksterHtml({
        tools: '<ul><li>Soldering iron</li><li>Wire cutters</li></ul>',
      });
      const url = new URL('https://www.hackster.io/maker/project');

      const result = await hacksterHandler.import(url, html);

      const toolBlock = result.content.find(([type]) => type === 'toolList');
      expect(toolBlock).toBeDefined();
      if (toolBlock) {
        const tools = (toolBlock[1] as { tools: Array<{ name: string }> }).tools;
        expect(tools.length).toBe(2);
        expect(tools[0].name).toBe('Soldering iron');
      }
    });

    it('should mark as partial when no story content found', async () => {
      const html = `<!DOCTYPE html><html><head><title>Empty</title></head>
        <body><h1>Project</h1><div class="no-content"></div></body></html>`;
      const url = new URL('https://www.hackster.io/maker/empty-project');

      const result = await hacksterHandler.import(url, html);
      expect(result.partial).toBe(true);
    });

    it('should extract tag names from Algolia platform objects', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          hits: [{
            name: 'Test',
            platforms: [{ id: 1, name: 'Arduino' }, { id: 2, name: 'ESP32' }],
            programming_languages: [{ id: 3, name: 'C++' }],
          }],
        }),
      });

      const html = buildHacksterHtml();
      const url = new URL('https://www.hackster.io/maker/project');

      const result = await hacksterHandler.import(url, html);

      expect(result.tags).toContain('Arduino');
      expect(result.tags).toContain('ESP32');
      expect(result.tags).toContain('C++');
      expect(result.tags.every(t => typeof t === 'string')).toBe(true);
    });

    it('should deduplicate tags', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          hits: [{
            name: 'Test',
            platforms: [{ id: 1, name: 'Arduino' }, { id: 2, name: 'ESP32' }],
            programming_languages: [{ id: 3, name: 'C++' }, { id: 1, name: 'Arduino' }],
          }],
        }),
      });

      const html = buildHacksterHtml();
      const url = new URL('https://www.hackster.io/maker/project');

      const result = await hacksterHandler.import(url, html);

      const arduinoCount = result.tags.filter(t => t === 'Arduino').length;
      expect(arduinoCount).toBe(1);
    });

    it('should extract quantity from "×N" notation', async () => {
      const html = buildHacksterHtml({
        parts: '<ul><li>Resistor 470Ω ×10</li><li>Capacitor ×3</li></ul>',
      });
      const url = new URL('https://www.hackster.io/maker/project');

      const result = await hacksterHandler.import(url, html);

      const partsBlock = result.content.find(([type]) => type === 'partsList');
      expect(partsBlock).toBeDefined();
      if (partsBlock) {
        const parts = (partsBlock[1] as { parts: Array<{ name: string; qty: number }> }).parts;
        expect(parts[0].qty).toBe(10);
        expect(parts[1].qty).toBe(3);
      }
    });

    it('should prefer HTML parts over Algolia parts', async () => {
      const html = buildHacksterHtml({
        parts: '<ul><li>Custom Part ×1</li></ul>',
      });
      const url = new URL('https://www.hackster.io/maker/project');

      const result = await hacksterHandler.import(url, html);

      const partsBlock = result.content.find(([type]) => type === 'partsList');
      expect(partsBlock).toBeDefined();
      if (partsBlock) {
        const parts = (partsBlock[1] as { parts: Array<{ name: string }> }).parts;
        expect(parts[0].name).toBe('Custom Part');
      }
    });

    it('should fall back to Algolia parts when HTML has none', async () => {
      // No project-things section at all
      const html = `<!DOCTYPE html><html><head>
        <title>Test Project | Hackster.io</title>
      </head><body>
        <h1>Test Project</h1>
        <div itemprop="text">
          <p>A project with no parts section in the HTML but parts available via Algolia search index data.</p>
          <p>Additional content to make the story extraction work properly with enough text for processing.</p>
        </div>
      </body></html>`;
      const url = new URL('https://www.hackster.io/maker/led-weather-station');

      const result = await hacksterHandler.import(url, html);

      const partsBlock = result.content.find(([type]) => type === 'partsList');
      expect(partsBlock).toBeDefined();
      if (partsBlock) {
        const parts = (partsBlock[1] as { parts: Array<{ name: string }> }).parts;
        expect(parts[0].name).toBe('Arduino Uno Rev3');
      }
    });

    it('should handle code blocks in story content', async () => {
      const html = buildHacksterHtml();
      const url = new URL('https://www.hackster.io/maker/project');

      const result = await hacksterHandler.import(url, html);

      const codeBlock = result.content.find(([type]) => type === 'code');
      if (codeBlock) {
        expect(codeBlock[1]).toHaveProperty('language', 'cpp');
      }
    });

    it('should place parts before story content', async () => {
      const html = buildHacksterHtml();
      const url = new URL('https://www.hackster.io/maker/project');

      const result = await hacksterHandler.import(url, html);

      // First block should be partsList
      expect(result.content[0][0]).toBe('partsList');
    });

    it('should handle real hackster h3 tags with nested empty p elements', async () => {
      // Real hackster pattern: <h3 class='hckui__typography__h3 title-with-anchor' id='toc-...'><p><p class='hckui__typography__bodyL'></p></p><span>Title</span></h3>
      const html = buildHacksterHtml({
        story: `
          <h3 class='hckui__typography__h3 title-with-anchor' id='toc-1--requirements-0'><p ><p class='hckui__typography__bodyL'></p></p><span >1. Requirements</span></h3>
          <p class='hckui__typography__bodyL'>You will need the following items.</p>
          <h3 class='hckui__typography__h3 title-with-anchor' id='toc-hardware-1'><p ><p class='hckui__typography__bodyL'></p></p><span >Hardware</span></h3>
          <p class='hckui__typography__bodyL'>A Raspberry Pi 4 or 5 with at least 2GB RAM.</p>
          <h3 class='hckui__typography__h3 title-with-anchor' id='toc-2--setup-3'><p ><p class='hckui__typography__bodyL'></p></p><span >2. Development Environment Setup</span></h3>
          <p class='hckui__typography__bodyL'>Install the required tools.</p>
        `,
      });
      const url = new URL('https://www.hackster.io/virgilvox/project');

      const result = await hacksterHandler.import(url, html);

      const headings = result.content.filter(([type]) => type === 'heading');
      expect(headings.length).toBe(3);
      expect((headings[0]![1] as { text: string }).text).toBe('1. Requirements');
      expect((headings[1]![1] as { text: string }).text).toBe('Hardware');
      expect((headings[2]![1] as { text: string }).text).toBe('2. Development Environment Setup');
    });

    it('should convert bold-only paragraphs that look like step headers to heading blocks', async () => {
      const html = buildHacksterHtml({
        story: `
          <p><strong>Introduction</strong></p>
          <p>This project demonstrates the concept.</p>
          <p><strong>Step 1: Prepare the Board</strong></p>
          <p>Solder the header pins onto the board.</p>
          <p><strong>Step 2: Upload Code</strong></p>
          <p>Flash the firmware via USB.</p>
        `,
      });
      const url = new URL('https://www.hackster.io/maker/project');

      const result = await hacksterHandler.import(url, html);

      const headings = result.content.filter(([type]) => type === 'heading');
      expect(headings.length).toBe(3);
      expect((headings[0]![1] as { text: string }).text).toBe('Introduction');
      expect((headings[1]![1] as { text: string }).text).toBe('Step 1: Prepare the Board');
      expect((headings[2]![1] as { text: string }).text).toBe('Step 2: Upload Code');
    });

    it('should place tools after parts and before story', async () => {
      const html = buildHacksterHtml({
        tools: '<ul><li>Multimeter</li></ul>',
      });
      const url = new URL('https://www.hackster.io/maker/project');

      const result = await hacksterHandler.import(url, html);

      const partsIdx = result.content.findIndex(([type]) => type === 'partsList');
      const toolsIdx = result.content.findIndex(([type]) => type === 'toolList');
      const firstStoryIdx = result.content.findIndex(([type]) => type !== 'partsList' && type !== 'toolList');

      expect(partsIdx).toBeLessThan(toolsIdx);
      expect(toolsIdx).toBeLessThan(firstStoryIdx);
    });
  });
});
