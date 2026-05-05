#!/usr/bin/env python3
"""Gemma line-number gate.

For each claim in manifest.md, ship the FULL target.py (with line numbers
prefixed) to a local Gemma model via LM Studio's OpenAI-compatible API,
and demand a single-token TRUE/FALSE verdict. Emit a preamble that lists
every claim with its verdict.

Usage:
    python3 gemma_gate.py [--model MODEL_ID] [--port 1234]

Writes preamble to stdout and to results/round2_preamble.txt.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"
RESULTS.mkdir(exist_ok=True)

CLAIM_RE = re.compile(r"^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*$")


def parse_manifest(text: str) -> list[tuple[int, str]]:
    out = []
    for line in text.splitlines():
        m = CLAIM_RE.match(line)
        if not m:
            continue
        out.append((int(m.group(1)), m.group(2)))
    return out


def numbered_source(text: str) -> str:
    return "\n".join(f"{i+1:>4}: {ln}" for i, ln in enumerate(text.splitlines()))


def ask_gemma(model: str, port: int, prompt: str) -> str:
    body = json.dumps({
        "model": model,
        "messages": [
            {"role": "system",
             "content": ("You are a strict line-checker. The user gives you a "
                         "source file with line numbers and a claim about ONE "
                         "specific line. Reply with exactly one word: TRUE or "
                         "FALSE. No punctuation, no explanation. /no_think")},
            {"role": "user", "content": prompt + "\n\n/no_think"},
        ],
        "temperature": 0.0,
        "max_tokens": 16,
        "chat_template_kwargs": {"enable_thinking": False},
    }).encode()
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}/v1/chat/completions",
        data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read())
    return data["choices"][0]["message"]["content"].strip().upper()


def verdict_for(model: str, port: int, source_numbered: str,
                line_no: int, claim: str) -> str:
    prompt = (
        f"FILE (line-numbered):\n```\n{source_numbered}\n```\n\n"
        f"CLAIM: line {line_no} of the file matches this description:\n"
        f"  \"{claim}\"\n\n"
        "Look at line {line_no} EXACTLY (not nearby lines). Does the actual "
        "content of that exact line match the claim?\n"
        "Answer with one word: TRUE or FALSE."
    ).format(line_no=line_no)
    raw = ask_gemma(model, port, prompt)
    cleaned = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    cleaned = re.sub(r"[^A-Z]+", " ", cleaned).strip()
    if "TRUE" in cleaned.split():
        return "TRUE"
    if "FALSE" in cleaned.split():
        return "FALSE"
    return f"UNCLEAR({raw[:40]!r})"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="gemma-4-e2b-uncensored-hauhaucs-aggressive")
    ap.add_argument("--port", type=int, default=1234)
    args = ap.parse_args()

    target = (HERE / "target.py").read_text()
    manifest_text = (HERE / "manifest.md").read_text()
    claims = parse_manifest(manifest_text)
    if not claims:
        print("no claims parsed from manifest.md", file=sys.stderr)
        return 2

    numbered = numbered_source(target)
    rows: list[tuple[int, str, str]] = []
    for ln, claim in claims:
        v = verdict_for(args.model, args.port, numbered, ln, claim)
        rows.append((ln, v, claim))
        print(f"  L{ln:>3}  {v:<14} {claim[:60]}", file=sys.stderr)

    n_true = sum(1 for _, v, _ in rows if v == "TRUE")
    n_false = sum(1 for _, v, _ in rows if v == "FALSE")
    n_other = len(rows) - n_true - n_false

    out = []
    out.append("=== GEMMA LINE-NUMBER GATE PREAMBLE ===")
    out.append(f"verdicts: {n_true} TRUE, {n_false} FALSE, {n_other} unclear "
               f"(total {len(rows)})")
    out.append("")
    out.append("per-claim verdict (line N of target.py vs manifest claim):")
    for ln, v, claim in rows:
        out.append(f"  [{v}] line {ln}: {claim}")
    out.append("=== END PREAMBLE ===")
    preamble = "\n".join(out)

    (RESULTS / "round2_preamble.txt").write_text(preamble + "\n")
    print(preamble)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
