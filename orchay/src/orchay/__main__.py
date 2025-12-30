"""orchay 패키지 진입점."""

import multiprocessing
import sys

from orchay.launcher import main

if __name__ == "__main__":
    # PyInstaller frozen 환경에서 multiprocessing 지원
    multiprocessing.freeze_support()
    sys.exit(main())
