from __future__ import annotations

import asyncio
from functools import lru_cache
from pathlib import Path
from typing import Iterable, List

import joblib
import numpy as np
from loguru import logger

MODEL_FILENAME = "survival_6hr_model.pkl"
MODEL_FEATURES = [
    "meld",
    "age",
    "comorbidities",
    "bilirubin",
    "inr",
    "creatinine",
    "ascites_grade",
    "encephalopathy_grade",
    "hospitalized_last_7d",
]


@lru_cache(maxsize=1)
def _load_model() -> object:
    model_path = Path(__file__).with_name(MODEL_FILENAME)
    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found at {model_path}")
    logger.info("Loading survival model from %s", model_path)
    return joblib.load(model_path)


async def predict_survival(features: Iterable[List[float]]) -> List[float]:
    loop = asyncio.get_running_loop()
    model = _load_model()
    array = np.asarray(list(features), dtype=float)

    def _predict_regression() -> np.ndarray:
        predictions = model.predict(array)
        predictions = np.clip(predictions, 0.0, 1.0)
        return predictions

    predictions = await loop.run_in_executor(None, _predict_regression)
    return predictions.tolist()

