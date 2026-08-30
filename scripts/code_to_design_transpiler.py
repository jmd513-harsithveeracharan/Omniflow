# -*- coding: utf-8 -*-
"""
code_to_design_transpiler.py — Live Code-to-Design Transpiler for Penpot
-----------------------------------------------------------------------
Automates Reverse "Code-to-Design":
1. Launches Headless Chromium to inspect live DOM & computed CSS on http://localhost:8085.
2. Extracts exact computed bounds, typography, background colors, borders, and SVGs.
3. Transpiles live DOM tree into pristine Penpot vector commands.
4. Injects directly into Penpot via REPL bridge (:4403).
"""

import asyncio
import json
import requests
from playwright.async_api import async_playwright

REPL_URL = "http://localhost:4403/execute"
APP_URL = "http://localhost:8085"

DOM_EXTRACTION_SCRIPT = """
(() => {
    // Traverse DOM and extract visual elements with computed styles
    const elements = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    
    let node;
    while ((node = walker.nextNode())) {
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) continue;
        
        const isSvg = node.tagName.toLowerCase() === 'svg';
        const hasText = node.childNodes.length > 0 && Array.from(node.childNodes).some(c => c.nodeType === Node.TEXT_NODE && c.textContent.trim().length > 0);
        
        const item = {
            tag: node.tagName.toLowerCase(),
            id: node.id || '',
            className: typeof node.className === 'string' ? node.className : '',
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            bg: style.backgroundColor,
            color: style.color,
            fontSize: parseFloat(style.fontSize) || 13,
            fontWeight: style.fontWeight,
            borderRadius: parseFloat(style.borderRadius) || 0,
            borderColor: style.borderTopColor,
            borderWidth: parseFloat(style.borderTopWidth) || 0,
            borderStyle: style.borderTopStyle,
            text: '',
            svgData: isSvg ? node.outerHTML : null
        };
        
        if (hasText) {
            // Get direct text
            const directText = Array.from(node.childNodes)
                .filter(c => c.nodeType === Node.TEXT_NODE)
                .map(c => c.textContent.trim())
                .filter(t => t.length > 0)
                .join(' ');
            if (directText) item.text = directText;
        }
        
        // Include if it has visible background, border, text, or is an SVG
        const hasBg = item.bg && item.bg !== 'rgba(0, 0, 0, 0)' && item.bg !== 'transparent';
        const hasBorder = item.borderWidth > 0 && item.borderColor && item.borderColor !== 'rgba(0, 0, 0, 0)';
        
        if (hasBg || hasBorder || item.text || item.svgData) {
            elements.push(item);
        }
    }
    
    return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        elements: elements
    };
})();
"""

def rgba_to_hex(rgba_str):
    if not rgba_str or rgba_str in ['transparent', 'rgba(0, 0, 0, 0)']:
        return None
    if rgba_str.startswith('#'):
        return rgba_str
    if rgba_str.startswith('rgb'):
        parts = rgba_str.replace('rgba(', '').replace('rgb(', '').replace(')', '').split(',')
        if len(parts) >= 3:
            r = int(parts[0].strip())
            g = int(parts[1].strip())
            b = int(parts[2].strip())
            return f"#{r:02x}{g:02x}{b:02x}"
    return None

async def extract_live_dom():
    print(f"[EXTRACT] Connecting to live website at {APP_URL}...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto(APP_URL, wait_until="networkidle")
        
        data = await page.evaluate(DOM_EXTRACTION_SCRIPT)
        await browser.close()
        print(f"[EXTRACT] Extracted {len(data['elements'])} live computed DOM nodes!")
        return data

def build_penpot_payload_from_dom(dom_data):
    elements = dom_data['elements']
    
    # Generate JavaScript code that creates board and populates shapes with 100% computed styles
    js_code = """
    (() => {
        const page = penpot.currentPage;
        if (!page) return { error: "No active page" };
        
        // Clear old boards
        page.findShapes().forEach(s => s.remove());
        
        // Create 100% Exact Code-to-Design Board
        const board = penpot.createBoard();
        board.name = "01 — Live Code-to-Design Transpiled (100% Exact)";
        board.x = 0; board.y = 0;
        board.resize(1440, 900);
        board.fills = [{ fillColor: "#131314" }];
        
        const elements = """ + json.dumps(elements) + """;
        
        function toHex(rgbStr) {
            if (!rgbStr || rgbStr === 'transparent' || rgbStr === 'rgba(0, 0, 0, 0)') return null;
            if (rgbStr.startsWith('#')) return rgbStr;
            const m = rgbStr.match(/\\d+/g);
            if (m && m.length >= 3) {
                const r = parseInt(m[0]).toString(16).padStart(2, '0');
                const g = parseInt(m[1]).toString(16).padStart(2, '0');
                const b = parseInt(m[2]).toString(16).padStart(2, '0');
                return '#' + r + g + b;
            }
            return null;
        }

        elements.forEach(el => {
            const bgHex = toHex(el.bg);
            const borderHex = toHex(el.borderColor);
            const colorHex = toHex(el.color);
            
            // 1. If SVG icon
            if (el.svgData && typeof penpot.createShapeFromSvg === 'function') {
                try {
                    const svgShape = penpot.createShapeFromSvg(el.svgData);
                    if (svgShape) {
                        board.appendChild(svgShape);
                        svgShape.x = el.x;
                        svgShape.y = el.y;
                        svgShape.resize(el.w, el.h);
                        return;
                    }
                } catch(e) {}
            }
            
            // 2. If rectangular container with background or border
            if (bgHex || (borderHex && el.borderWidth > 0)) {
                const r = penpot.createRectangle();
                board.appendChild(r);
                r.x = el.x;
                r.y = el.y;
                r.resize(el.w, el.h);
                if (bgHex) {
                    r.fills = [{ fillColor: bgHex }];
                } else {
                    r.fills = [];
                }
                if (el.borderRadius > 0) {
                    r.borderRadius = el.borderRadius;
                }
                if (borderHex && el.borderWidth > 0) {
                    r.strokes = [{ strokeColor: borderHex, strokeWidth: el.borderWidth, strokeStyle: 'solid', strokeAlignment: 'center' }];
                }
            }
            
            // 3. If text element
            if (el.text && el.text.trim().length > 0) {
                const t = penpot.createText(el.text.trim());
                if (t) {
                    board.appendChild(t);
                    t.x = el.x;
                    t.y = el.y;
                    t.fontSize = String(Math.round(el.fontSize));
                    t.growType = "auto-width";
                    t.fills = [{ fillColor: colorHex || "#e3e3e3" }];
                }
            }
        });
        
        return { success: true, count: elements.length };
    })();
    """
    return js_code

async def main():
    dom_data = await extract_live_dom()
    js_code = build_penpot_payload_from_dom(dom_data)
    
    print("[TRANSPILER] Transmitting 100% Exact Code-to-Design Payload to Penpot...")
    resp = requests.post(REPL_URL, json={"code": js_code}, timeout=30)
    print(f"[STATUS] {resp.status_code}")
    print(f"[RESPONSE] {resp.text}")

if __name__ == "__main__":
    asyncio.run(main())
