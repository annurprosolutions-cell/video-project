#!/usr/bin/env bash
# Render every segment with N parallel workers, then mux with the song.
# usage: ./render-all.sh [workers] [segments...]
set -e
cd "$(dirname "$0")"
N=${1:-2}; shift || true
SEGS=${@:-$(seq 0 14)}
printf '%s\n' $SEGS | xargs -P "$N" -I{} sh -c 'node render.mjs seg {} 30 > parts/log_{}.txt 2>&1 || echo "seg {} failed"'
node render.mjs mux sekadar-kehilangan.mp4
