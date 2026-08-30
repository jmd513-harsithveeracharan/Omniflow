"""
scripts/test_vision_analysis.py
--------------------------------
Test script to demonstrate sending an image (chat.png) to a Multimodal Vision LLM (Gemini / Claude / OpenAI).
"""

import os
import sys
import base64
import requests

# Ensure project root is on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


from app.config import GEMINI_KEY, ANTHROPIC_KEY, OPENAI_KEY, LLM_MODELS


def analyze_image_with_vision(image_path: str, prompt: str = "Explain what this image is and describe its UI layout and contents in detail."):
    if not os.path.exists(image_path):
        print(f"❌ Error: Image file not found at {image_path}")
        return

    print(f"📷 Loading image: {image_path} ({os.path.getsize(image_path) / 1024:.1f} KB)")
    with open(image_path, "rb") as f:
        image_bytes = f.read()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    # Detect MIME type
    mime_type = "image/png"
    if image_path.lower().endswith(".jpg") or image_path.lower().endswith(".jpeg"):
        mime_type = "image/jpeg"
    elif image_path.lower().endswith(".webp"):
        mime_type = "image/webp"

    # 1. Attempt with Gemini Vision
    if GEMINI_KEY:
        model = LLM_MODELS.get("gemini_standard", "gemini-2.5-flash")
        print(f"🚀 Calling Gemini Vision API ({model})...")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_KEY}"
        payload = {
            "contents": [{
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": image_b64
                        }
                    }
                ]
            }]
        }
        try:
            resp = requests.post(url, json=payload, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            explanation = data["candidates"][0]["content"]["parts"][0]["text"]
            print("\n" + "=" * 60)
            print("👁️ VISION ANALYSIS RESULT (Gemini):")
            print("=" * 60)
            print(explanation)
            return
        except Exception as e:
            print(f"⚠️ Gemini Vision failed: {e}. Trying next provider...")

    # 2. Fallback to Claude Vision
    if ANTHROPIC_KEY:
        model = LLM_MODELS.get("anthropic_high", "claude-3-7-sonnet-20250219")
        print(f"🚀 Calling Claude Vision API ({model})...")
        headers = {
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "max_tokens": 2048,
            "messages": [{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime_type,
                            "data": image_b64
                        }
                    },
                    {"type": "text", "text": prompt}
                ]
            }]
        }
        try:
            resp = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            explanation = data["content"][0]["text"]
            print("\n" + "=" * 60)
            print("👁️ VISION ANALYSIS RESULT (Claude):")
            print("=" * 60)
            print(explanation)
            return
        except Exception as e:
            print(f"⚠️ Claude Vision failed: {e}. Trying next provider...")

    # 3. Fallback to OpenAI Vision
    if OPENAI_KEY:
        model = LLM_MODELS.get("openai_high", "gpt-4o")
        print(f"🚀 Calling OpenAI Vision API ({model})...")
        headers = {
            "Authorization": f"Bearer {OPENAI_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "max_tokens": 2048,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{image_b64}"}
                    }
                ]
            }]
        }
        try:
            resp = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            explanation = data["choices"][0]["message"]["content"]
            print("\n" + "=" * 60)
            print("👁️ VISION ANALYSIS RESULT (OpenAI):")
            print("=" * 60)
            print(explanation)
            return
        except Exception as e:
            print(f"❌ OpenAI Vision failed: {e}")

    print("❌ No vision provider succeeded. Please check your API keys in .env.")


if __name__ == "__main__":
    img_target = os.path.join(BASE_DIR, "assets", "screenshots", "chat.png")
    analyze_image_with_vision(img_target)
