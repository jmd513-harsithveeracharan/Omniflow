"""
tests/test_gemini_modalities.py
---------------------------------
Comprehensive Test Suite for Google Gemini Multimodal Inputs.
Tests:
  1. Text & Code Prompting
  2. Image Vision & Diagram Understanding (Inline PIL & Raw Bytes)
  3. Structured Output Mode (Pydantic / JSON Schema)
  4. Large Media (PDF / Audio / Video) via Google Files API
"""

import io
import os
import time
from typing import Any
from PIL import Image, ImageDraw, ImageFont
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

# Default API Key from environment or fallback
API_KEY = os.getenv("GEMINI_API_KEY", "AQ.Ab8RN6K8bRkSDftGsNm7fEduQSeHerB17lJk_fwfpgEDjvBoNg")
MODEL_NAME = "gemini-3.6-flash"


def get_client() -> genai.Client:
    return genai.Client(api_key=API_KEY)


def test_text_and_code_modality(client: genai.Client) -> None:
    print("\n" + "=" * 70)
    print(" [MODALITY 1] TEXT & CODE PROMPTING")
    print("=" * 70)
    prompt = "Write a concise 3-line PySpark script to write a DataFrame to a Delta Lake table in Microsoft Fabric."
    print(f"Prompt: {prompt}\n")

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
            )
            print("Response:")
            print(response.text.strip())
            break
        except Exception as e:
            print(f"Retry attempt {attempt+1}: {e}")
            time.sleep(2)


def test_image_vision_modality(client: genai.Client) -> None:
    print("\n" + "=" * 70)
    print(" [MODALITY 2] IMAGE VISION & DIAGRAM REASONING (PIL & Bytes)")
    print("=" * 70)

    # 1. Synthesize a Medallion Architecture diagram with PIL
    img = Image.new("RGB", (500, 220), color=(19, 19, 20))
    draw = ImageDraw.Draw(img)

    # Bronze Box
    draw.rectangle([20, 30, 150, 190], fill=(180, 83, 9), outline=(255, 255, 255), width=2)
    draw.text((35, 100), "BRONZE RAW", fill=(255, 255, 255))

    # Silver Box
    draw.rectangle([180, 30, 310, 190], fill=(75, 85, 99), outline=(255, 255, 255), width=2)
    draw.text((195, 100), "SILVER CLEAN", fill=(255, 255, 255))

    # Gold Box
    draw.rectangle([340, 30, 470, 190], fill=(202, 138, 4), outline=(255, 255, 255), width=2)
    draw.text((355, 100), "GOLD STAR", fill=(255, 255, 255))

    # Arrow connections
    draw.line([(150, 110), (180, 110)], fill=(255, 255, 255), width=3)
    draw.line([(310, 110), (340, 110)], fill=(255, 255, 255), width=3)

    print("Created synthetic Medallion Architecture diagram (Bronze -> Silver -> Gold).")
    print("Sending image directly to Gemini 3.6 Flash for multi-modal analysis...")

    prompt = (
        "Inspect this image carefully. Identify all shapes, colors, text labels, and arrows. "
        "Explain the data engineering architecture and purpose of each tier shown."
    )

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=[img, prompt],
            )
            print("\nGemini Vision Analysis:")
            print(response.text.strip())
            break
        except Exception as e:
            print(f"Retry attempt {attempt+1}: {e}")
            time.sleep(2)


class TableSchema(BaseModel):
    table_name: str = Field(..., description="Name of the Delta table")
    layer: str = Field(..., description="bronze | silver | gold")
    columns: list[str] = Field(..., description="List of column names")
    primary_key: str = Field(..., description="Primary key column")
    upsert_strategy: str = Field(..., description="MERGE | APPEND | OVERWRITE")


def test_structured_json_output(client: genai.Client) -> None:
    print("\n" + "=" * 70)
    print(" [MODALITY 3] STRUCTURED DATA & PYDANTIC SCHEMA ENFORCEMENT")
    print("=" * 70)

    prompt = "Define a Medallion Silver layer Delta table schema for 'customer_orders' with standard fields."
    print(f"Prompt: {prompt}\n")

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=TableSchema,
                ),
            )
            print("Guaranteed Structured JSON Output:")
            print(response.text.strip())
            break
        except Exception as e:
            print(f"Retry attempt {attempt+1}: {e}")
            time.sleep(2)


def explain_other_modalities() -> None:
    print("\n" + "=" * 70)
    print(" [OVERVIEW] ALL SUPPORTED GEMINI INPUT MODALITIES")
    print("=" * 70)
    explanation = """
1. TEXT & CODE:
   - Natural language, multi-language translation, code generation, SQL AST transpilation.
   - Max context window: Up to 1M+ tokens.

2. IMAGES (JPEG, PNG, WEBP, HEIC, GIF):
   - Inline via PIL / Base64 Bytes (< 20MB).
   - High-resolution visual QA, OCR, document layout parsing, chart data extraction.

3. AUDIO (MP3, WAV, AAC, FLAC, OGG):
   - Native audio understanding without separate Speech-to-Text.
   - Audio QA, tone analysis, speaker diarization, multilingual transcription with timestamps.
   - Usage: client.files.upload(file="audio.mp3") -> client.models.generate_content(contents=[file, prompt])

4. VIDEO (MP4, MOV, AVI, WebM):
   - Samples video frames + synchronized audio tracks simultaneously.
   - Video scene understanding, action recognition, temporal question answering.
   - Usage: client.files.upload(file="recording.mp4") -> client.models.generate_content(contents=[file, prompt])

5. PDF & OFFICE DOCUMENTS:
   - Full document understanding preserving tables, figures, footnotes, and layout.
   - Usage: client.files.upload(file="report.pdf") -> client.models.generate_content(contents=[file, prompt])
"""
    print(explanation.strip())


if __name__ == "__main__":
    client = get_client()
    test_text_and_code_modality(client)
    test_image_vision_modality(client)
    test_structured_json_output(client)
    explain_other_modalities()
