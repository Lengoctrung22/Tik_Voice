#!/usr/bin/env python3
import sys
import os
import json
import asyncio

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

async def main():
    input_str = ""
    if len(sys.argv) >= 2 and sys.argv[1] != "-":
        input_str = sys.argv[1]

    if not input_str:
        try:
            input_str = sys.stdin.read().strip()
        except Exception:
            pass

    if not input_str:
        error_res = {"success": False, "error": "Missing input payload via arguments or stdin"}
        sys.stdout.buffer.write(json.dumps(error_res).encode('utf-8'))
        sys.exit(1)

    try:
        input_data = json.loads(input_str)
    except Exception as e:
        error_res = {"success": False, "error": f"Invalid JSON argument: {str(e)}"}
        sys.stdout.buffer.write(json.dumps(error_res).encode('utf-8'))
        sys.exit(1)

    text = input_data.get("text", "").strip()
    voice = input_data.get("voice", "vi-VN-HoaiMyNeural")
    rate = input_data.get("rate", "+0%")
    pitch = input_data.get("pitch", "+0Hz")
    output_path = input_data.get("outputPath", "")

    if not text:
        error_res = {"success": False, "error": "Empty text provided"}
        sys.stdout.buffer.write(json.dumps(error_res).encode('utf-8'))
        sys.exit(1)

    if not output_path:
        error_res = {"success": False, "error": "Empty outputPath provided"}
        sys.stdout.buffer.write(json.dumps(error_res).encode('utf-8'))
        sys.exit(1)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    import edge_tts

    words = []
    sentence_chunks = []
    word_chunks = []

    last_err = None
    for attempt in range(2):
        words = []
        sentence_chunks = []
        word_chunks = []
        try:
            communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
            with open(output_path, "wb") as f:
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        f.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        word_chunks.append(chunk)
                    elif chunk["type"] == "SentenceBoundary":
                        sentence_chunks.append(chunk)
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                last_err = None
                break
        except Exception as exc:
            last_err = exc
            if attempt == 0:
                await asyncio.sleep(0.5)
                continue
            raise

    if last_err is not None:
        raise last_err

    if word_chunks:
        prev_end = 0
        for chunk in word_chunks:
            start_ms = max(prev_end, int(chunk["offset"] / 10000))
            end_ms = max(start_ms + 20, int((chunk["offset"] + chunk["duration"]) / 10000))
            words.append({"word": chunk["text"], "start": start_ms, "end": end_ms})
            prev_end = end_ms
    elif sentence_chunks:
        prev_end = 0
        for s in sentence_chunks:
            raw_start = int(s["offset"] / 10000)
            s_dur = int(s["duration"] / 10000)
            s_start = max(prev_end, raw_start)
            s_end = max(s_start + 40, raw_start + s_dur)
            effective_dur = s_end - s_start
            s_text = s["text"].strip()
            raw_words = s_text.split()
            if not raw_words:
                continue
            total_chars = sum(len(w) for w in raw_words)
            curr = s_start
            for idx, w in enumerate(raw_words):
                w_dur = (len(w) / total_chars) * effective_dur
                w_end = s_end if idx == len(raw_words) - 1 else curr + w_dur
                w_start_int = max(prev_end, int(curr))
                w_end_int = max(w_start_int + 10, int(w_end))
                words.append({"word": w, "start": w_start_int, "end": w_end_int})
                prev_end = w_end_int
                curr = w_end
    elif text and os.path.exists(output_path):
        try:
            file_bytes = os.path.getsize(output_path)
            est_duration = max(1.0, file_bytes / 6000.0)
            raw_words = text.split()
            if raw_words:
                total_chars = sum(len(w) for w in raw_words)
                curr = 0
                for idx, w in enumerate(raw_words):
                    w_dur = (len(w) / total_chars) * (est_duration * 1000)
                    w_end = int(est_duration * 1000) if idx == len(raw_words) - 1 else int(curr + w_dur)
                    words.append({"word": w, "start": int(curr), "end": int(w_end)})
                    curr = w_end
        except Exception:
            pass

    total_duration = (words[-1]["end"] / 1000.0) if words else 0.0

    result = {
        "success": True,
        "audioPath": output_path,
        "audioDuration": round(total_duration, 2),
        "words": words
    }

    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))

if __name__ == "__main__":
    asyncio.run(main())
