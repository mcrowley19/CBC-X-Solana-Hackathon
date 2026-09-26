from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = PACKAGE_ROOT.parent


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def load_default_env() -> None:
    load_env_file(PACKAGE_ROOT / ".env")
    load_env_file(REPO_ROOT / ".env.local")


class Settings(BaseModel):
    logbook_host: str = "http://127.0.0.1:3000"
    device_api_key: str = ""
    driver_wallet: str = ""
    device_id: str = "pi-01"
    vlm_backend: str = "auto"
    vlm_model: str = ""
    out_dir: Path = Field(default_factory=lambda: PACKAGE_ROOT / "out")
    post: bool = True
    yolo_model: str = "yolo11n.pt"
    yolo_device: str = "cpu"

    @classmethod
    def from_env(cls) -> Settings:
        load_default_env()
        data: dict[str, object] = {}
        mapping = {
            "LOGBOOK_HOST": "logbook_host",
            "DEVICE_API_KEY": "device_api_key",
            "DRIVER_WALLET": "driver_wallet",
            "DEVICE_ID": "device_id",
            "VLM_BACKEND": "vlm_backend",
            "VLM_MODEL": "vlm_model",
            "LOGBOOK_OUT": "out_dir",
            "YOLO_MODEL": "yolo_model",
            "YOLO_DEVICE": "yolo_device",
        }
        for env_name, field in mapping.items():
            if os.environ.get(env_name):
                data[field] = os.environ[env_name]
        return cls.model_validate(data)
