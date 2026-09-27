# macOS host has no GNU `timeout` — always dispatch the portable Perl watchdog

**Date:** 2026-09-27 (Phase 2 auth verification, unit-p2 worker)
**Root cause:** The strict "Run Single Test Pack" template ships `timeout 300 <pack>` as the
command-level guard. This macOS host has no GNU coreutils `timeout` (`timeout: command not found`),
so the wrapper fails in 0s with an ENV-MISMATCH before the pack starts. It is a dispatch-template
bug, not an environment regression.

**Fix:** Use the project-standard portable outer watchdog already documented in `PACKS.md`
(Perl `fork` + `setpgrp` + `alarm 300`, exits 0/1/124 and kills the whole process group):

```bash
perl -e '
use strict; use warnings; use POSIX ":sys_wait_h";
my $t = 300; my $child;
$SIG{ALRM} = sub { kill "KILL", -$child; kill "KILL", $child; exit 124; };
$child = fork();
if (!defined $child) { exit 125; }
if ($child == 0) { setpgrp(0,0); { exec(@ARGV) } exit 127; }
setpgrp(0,$child);
alarm $t;
waitpid($child,0);
my $raw = $?;
alarm 0;
exit((($raw & 127) != 0) ? (128 + ($raw & 127)) : ($raw >> 8));
' bash -c 'set -o pipefail; bash <pack-path> 2>&1 | tee <log-path>'
```

**Rule going forward:** every worker dispatch on this project embeds the Perl watchdog verbatim;
never write a bare `timeout 300` into a task message. Cost of the miss: one wasted worker cycle
(~1 min) per affected dispatch.
