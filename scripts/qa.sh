#!/bin/bash
# usage: scripts/qa.sh <outDir> <chapter> <beats...>  — settles each beat deterministically and shoots it
out=$1; ch=$2; shift 2
steps="ready|enter|live|wait:1200"
for b in "$@"; do steps="$steps|ch:$ch:$b|wait:1800|settle:50:0.2|wait:2500|settle:25:0.2|wait:900|shot:c${ch}_b${b}"; done
node scripts/flow.mjs "$out" "$steps" ${W:-1440} ${H:-900} "${Q:-?q=low&aa=0&dyn=0&debug=1}" ${MOB:-}
