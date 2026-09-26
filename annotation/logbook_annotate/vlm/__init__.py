from __future__ import annotations

import logging
import sys

from logbook_annotate.config import Settings
from logbook_annotate.vlm.mlx import DEFAULT_MODEL as MLX_DEFAULT
from logbook_annotate.vlm.mlx import MlxVlm
from logbook_annotate.vlm.ollama import OllamaVlm
from logbook_annotate.vlm.stub import StubVlm


def build_vlm(settings: Settings):
    backend = settings.vlm_backend
    if backend == "auto":
        backend = "mlx" if sys.platform == "darwin" else "stub"
    if backend == "stub":
        logging.getLogger("logbook").warning(
            "Vision backend is stub, so near misses and lane changes will not be tagged. On a Mac set VLM_BACKEND=mlx."
        )
        return StubVlm()
    if backend == "mlx":
        return MlxVlm(settings.vlm_model or MLX_DEFAULT)
    if backend == "ollama":
        return OllamaVlm(settings.vlm_model)
    raise RuntimeError(f"Unknown VLM_BACKEND {backend!r}. Use auto, mlx, ollama, or stub.")
