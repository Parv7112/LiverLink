from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

from .survival_model import MODEL_FEATURES, MODEL_FILENAME


def train(data_path: Path, output_path: Path) -> None:
    df = pd.read_csv(data_path)
    if "survival_6hr" not in df.columns:
        raise ValueError("Dataset must include survival_6hr column")

    X = df[MODEL_FEATURES]
    y = df["survival_6hr"]

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestRegressor(
        n_estimators=300,
        max_depth=12,
        min_samples_split=4,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_val)
    mae = mean_absolute_error(y_val, preds)
    r2 = r2_score(y_val, preds)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, output_path)
    print(f"Model saved to {output_path}")
    print(f"Validation MAE: {mae:.4f}")
    print(f"Validation R^2: {r2:.4f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train the 6-hour survival model")
    parser.add_argument(
        "--data",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "mock_data" / "patients_survival.csv",
        help="Path to training CSV",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).with_name(MODEL_FILENAME),
        help="Path to save trained model",
    )
    args = parser.parse_args()
    train(args.data, args.output)

