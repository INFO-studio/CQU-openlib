"""Small shared helpers."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def human(n: float) -> str:
    n = float(n)
    if n >= 1048576:
        return f"{n / 1048576:.1f}MB"
    if n >= 1024:
        return f"{n / 1024:.0f}KB"
    return f"{n:.0f}B"


def mb(n: float) -> float:
    return n / 1048576


def have(tool: str) -> bool:
    return shutil.which(tool) is not None


def run(cmd: list[str], *, log: Path | None = None) -> subprocess.CompletedProcess:
    if log is None:
        return subprocess.run(cmd, capture_output=True)
    with log.open("ab") as lf:
        lf.write(b"$ " + " ".join(cmd).encode() + b"\n")
        return subprocess.run(cmd, stdout=lf, stderr=subprocess.STDOUT)


def atomic_write(dst: Path, write) -> None:
    """Write via a temp file next to dst, then rename.

    An interrupted run leaves a *.partial file, never a half-written dst —
    which is how you end up with a "damaged" PDF that opens in nothing.
    """
    dst.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=dst.stem + ".", suffix=".partial" + dst.suffix, dir=dst.parent)
    os.close(fd)
    tmp = Path(name)
    try:
        write(tmp)
        os.chmod(tmp, 0o644)  # mkstemp gives 0600, which breaks sharing/serving
        os.replace(tmp, dst)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise


def copy_atomic(src: Path, dst: Path) -> None:
    if src.resolve() == dst.resolve():
        return
    atomic_write(dst, lambda tmp: shutil.copyfile(src, tmp))
