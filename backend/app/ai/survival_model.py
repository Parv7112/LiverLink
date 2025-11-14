from __future__ import annotations

import asyncio
from functools import lru_cache
import sys
import types
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
FEATURE_INDEX = {name: idx for idx, name in enumerate(MODEL_FEATURES)}


class HeuristicSurvivalModel:
    """Lightweight deterministic model used when the bootstrap pickle cannot be loaded."""

    def predict(self, data: Iterable[List[float] | np.ndarray]) -> np.ndarray:
        array = np.asarray(list(data), dtype=float)
        if array.size == 0:
            return np.empty(0, dtype=float)
        if array.ndim == 1:
            array = array.reshape(1, -1)

        meld = array[:, FEATURE_INDEX["meld"]]
        age = array[:, FEATURE_INDEX["age"]]
        comorbidities = array[:, FEATURE_INDEX["comorbidities"]]
        bilirubin = array[:, FEATURE_INDEX["bilirubin"]]
        inr = array[:, FEATURE_INDEX["inr"]]
        creatinine = array[:, FEATURE_INDEX["creatinine"]]
        ascites = array[:, FEATURE_INDEX["ascites_grade"]]
        encephalopathy = array[:, FEATURE_INDEX["encephalopathy_grade"]]
        hospitalized = array[:, FEATURE_INDEX["hospitalized_last_7d"]]

        meld_component = 1.1 - np.clip(meld / 35.0, 0, 1.2)
        age_component = 1.0 - np.clip((age - 25) / 70.0, 0, 0.9)
        organ_stress = (bilirubin / 20.0 + inr / 5.0 + creatinine / 4.5) / 3.0
        labs_component = 1.05 - np.clip(organ_stress, 0, 1.1)
        complication_component = 1.0 - 0.12 * np.clip(comorbidities / 8.0, 0, 1)
        ascites_component = 1.0 - 0.08 * np.clip(ascites / 3.0, 0, 1)
        enceph_component = 1.0 - 0.08 * np.clip(encephalopathy / 4.0, 0, 1)
        hospitalization_penalty = 0.12 * np.clip(hospitalized, 0, 1)

        score = (
            0.28 * meld_component
            + 0.2 * age_component
            + 0.18 * labs_component
            + 0.12 * complication_component
            + 0.08 * ascites_component
            + 0.08 * enceph_component
        )
        score -= hospitalization_penalty
        return np.clip(score, 0.05, 0.99)


def _register_pickle_shim() -> None:
    """Expose HeuristicSurvivalModel under module 'main' for legacy pickles."""
    module = sys.modules.get("main")
    if module is None:
        module = types.ModuleType("main")
        sys.modules["main"] = module
    setattr(module, "HeuristicSurvivalModel", HeuristicSurvivalModel)


_register_pickle_shim()


@lru_cache(maxsize=1)
def _load_model() -> object:
    model_path = Path(__file__).with_name(MODEL_FILENAME)
    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found at {model_path}")
    logger.info("Loading survival model from %s", model_path)
    try:
        return joblib.load(model_path)
    except AttributeError as exc:
        if "HeuristicSurvivalModel" in str(exc):
            logger.warning(
                "Bootstrap heuristic model could not be unpickled (%s). Falling back to built-in heuristic.",
                exc,
            )
            return HeuristicSurvivalModel()
        raise


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

