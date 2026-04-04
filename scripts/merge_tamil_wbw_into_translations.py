#!/usr/bin/env python3
"""
Merge Tamil WBW from tamil-wbw-translation.db into assets/database/wbw_translations.db.

The source DB uses coarser word boundaries (fewer rows per ayah) than translations.db.
Rows are aligned by mapping each source word k (0..Ns-1) to target word indices
[i_start, i_end) where:
  i_start = (k * Nt) // Ns
  i_end = ((k + 1) * Nt) // Ns
Nt = count of target rows with non-empty English (after HTML strip);
Ns = number of Tamil rows for that ayah.

Only updates `ta` where it is currently NULL or whitespace (preserves manual edits).
"""
from __future__ import annotations

import re
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DST = ROOT / "assets/database/wbw_translations.db"


def strip_html(html: str | None) -> str:
    if not html:
        return ""
    return re.sub(r"<[^>]*>?", "", html).strip()


def main() -> int:
    src_path = Path(
        sys.argv[1]
        if len(sys.argv) > 1
        else str(Path.home() / "Downloads/tamil-wbw-translation.db")
    )
    dst_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_DST

    if not src_path.is_file():
        print(f"Source DB not found: {src_path}", file=sys.stderr)
        return 1
    if not dst_path.is_file():
        print(f"Target DB not found: {dst_path}", file=sys.stderr)
        return 1

    src = sqlite3.connect(str(src_path))
    dst = sqlite3.connect(str(dst_path))

    s_cur = src.cursor()
    s_cur.execute(
        "SELECT surah_number, ayah_number, word_number, text FROM word_translation "
        "ORDER BY surah_number, ayah_number, CAST(word_number AS INTEGER)"
    )
    by_ayah: dict[tuple[int, int], list[tuple[str, str]]] = defaultdict(list)
    for surah, ayah, wn, text in s_cur.fetchall():
        t = (text or "").strip()
        by_ayah[(surah, ayah)].append((str(wn).strip(), t))

    d_cur = dst.cursor()
    d_cur.execute(
        "SELECT surah, ayah, word_index, en, ta FROM translations "
        "ORDER BY surah, ayah, CAST(word_index AS INTEGER)"
    )
    tgt_by_ayah: dict[tuple[int, int], list[tuple[str, str, str]]] = defaultdict(list)
    for surah, ayah, wi, en, ta in d_cur.fetchall():
        tgt_by_ayah[(surah, ayah)].append((str(wi).strip(), en or "", ta or ""))

    updates: list[tuple[str, int, int, str]] = []

    for key, src_rows in by_ayah.items():
        if key not in tgt_by_ayah:
            continue
        tgt_rows = tgt_by_ayah[key]
        texts_in_order = [t for _, t in src_rows]
        Ns = len(texts_in_order)
        if Ns == 0:
            continue

        meaningful: list[tuple[str, str, str]] = [
            (wi, en, ta) for wi, en, ta in tgt_rows if strip_html(en)
        ]
        Nt = len(meaningful)
        if Nt == 0:
            continue

        # 1) Exact key match: fill empty ta where word_index exists in source
        src_by_wn = {wn: t for wn, t in src_rows if t}
        for wi, _en, ta in tgt_rows:
            if ta and ta.strip():
                continue
            if wi in src_by_wn:
                updates.append((src_by_wn[wi], key[0], key[1], wi))

        # 2) Alignment fill for rows still empty
        still_need = {
            wi
            for wi, _en, ta in meaningful
            if (not ta or not ta.strip())
            and wi not in {u[3] for u in updates if u[1] == key[0] and u[2] == key[1]}
        }
        if not still_need or Nt < Ns:
            # Nt < Ns: rare; skip bucket fill (would need inverse mapping)
            continue

        for k in range(Ns):
            tamil = texts_in_order[k]
            if not tamil:
                continue
            i_start = (k * Nt) // Ns
            i_end = ((k + 1) * Nt) // Ns
            if i_start >= i_end:
                continue
            for idx in range(i_start, i_end):
                wi, _en, ta = meaningful[idx]
                if ta and ta.strip():
                    continue
                if wi not in still_need:
                    continue
                updates.append((tamil, key[0], key[1], wi))
                still_need.discard(wi)

    # Dedupe by (surah, ayah, wi) — last wins; prefer first assignment
    seen: set[tuple[int, int, str]] = set()
    deduped: list[tuple[str, int, int, str]] = []
    for tamil, surah, ayah, wi in updates:
        sk = (surah, ayah, wi)
        if sk in seen:
            continue
        seen.add(sk)
        deduped.append((tamil, surah, ayah, wi))

    d_cur.execute("BEGIN")
    try:
        for tamil, surah, ayah, wi in deduped:
            d_cur.execute(
                "UPDATE translations SET ta = ? WHERE surah = ? AND ayah = ? AND word_index = ? "
                "AND (ta IS NULL OR trim(ta) = '')",
                (tamil, surah, ayah, wi),
            )
        d_cur.execute("COMMIT")
    except Exception:
        d_cur.execute("ROLLBACK")
        raise

    print(f"Source ayahs with Tamil: {len(by_ayah)}")
    print(f"Updates applied (deduped rows): {len(deduped)}")
    print(f"  (includes exact-key + alignment; empty-ta only)")

    src.close()
    dst.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
