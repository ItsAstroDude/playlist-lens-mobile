#!/usr/bin/env bash
# Repeatable jank scenarios for playlist.lens on a USB-attached phone (1080x2520 inner screen).
# usage: scripts/perf/measure.sh <label> [scenario...]   scenarios: home tabs wrapped wrapped_year wrapped_all idle
ADB="${ADB:-/c/Users/andre/Desktop/Apps/Portable/platform-tools-latest-windows/platform-tools/adb.exe}"
PKG=com.andrei.playlistlens
LABEL=${1:-run}; shift
OUT="${OUT:-${TMPDIR:-/tmp}/playlistlens-perf}/$LABEL"; mkdir -p "$OUT"
SCEN=${@:-home tabs wrapped idle}
TAB_Y=2394; TAB_X=(184 421 658 895)   # lenses, queue, wrapped, swipe

tab() { "$ADB" shell input tap ${TAB_X[$1]} $TAB_Y; sleep 1.2; }
reset() { "$ADB" shell dumpsys gfxinfo $PKG reset >/dev/null; }
grab() { "$ADB" shell dumpsys gfxinfo $PKG > "$OUT/$1.gfx.txt"
  awk -v s="$1" '/Total frames rendered/{t=$4}/Janky frames:/{j=$3" "$4}/^50th percentile/{p50=$3}/^90th percentile/{p90=$3}/^95th percentile/{p95=$3}/^99th percentile/{p99=$3}/Slow UI thread/{ui=$5}
    END{printf "%-8s frames=%-5s janky=%-14s p50=%-6s p90=%-6s p95=%-6s p99=%s\n",s,t,j,p50,p90,p95,p99}' "$OUT/$1.gfx.txt" | tee -a "$OUT/summary.txt"; }

"$ADB" shell am force-stop $PKG; "$ADB" shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 6
for s in $SCEN; do case $s in
  home)  tab 0; reset; for i in 1 2 3 4 5; do "$ADB" shell input swipe 540 2000 540 700 250; sleep 0.9; done
         for i in 1 2 3 4 5; do "$ADB" shell input swipe 540 700 540 2000 250; sleep 0.9; done; grab home;;
  tabs)  tab 0; reset; for r in 1 2 3; do tab 1; tab 2; tab 3; tab 0; done; grab tabs;;
  wrapped) tab 2; sleep 1; reset; for i in 1 2 3 4 5 6; do "$ADB" shell input swipe 540 2000 540 700 250; sleep 0.9; done
         for i in 1 2 3 4 5 6; do "$ADB" shell input swipe 540 700 540 2000 250; sleep 0.9; done; grab wrapped;;
  wrapped_year|wrapped_all)
         tab 2; for i in 1 2 3; do "$ADB" shell input swipe 540 700 540 2000 120; done; sleep 0.5
         [ $s = wrapped_year ] && "$ADB" shell input tap 454 533 || "$ADB" shell input tap 626 533; sleep 5; reset
         for i in 1 2 3 4 5 6 7 8; do "$ADB" shell input swipe 540 2000 540 700 250; sleep 0.9; done
         for i in 1 2 3 4 5 6 7 8; do "$ADB" shell input swipe 540 700 540 2000 250; sleep 0.9; done; grab $s
         "$ADB" shell input tap 114 533; sleep 1;;
  idle)  tab 0; sleep 2; reset; "$ADB" shell top -b -H -d 2 -n 5 -p $("$ADB" shell pidof $PKG) > "$OUT/idle.top.txt"; grab idle
         awk '/^(Tasks|Threads)/{n++}/^ *[0-9]+ u0_/{c+=$9; th[$12]+=$9}END{printf "idle     avg CPU %.1f%% (%d samples)  top threads:",c/n,n; for(k in th) if(th[k]/n>1.5) printf " %s=%.1f",k,th[k]/n; print ""}' "$OUT/idle.top.txt" | tee -a "$OUT/summary.txt";;
esac; done
