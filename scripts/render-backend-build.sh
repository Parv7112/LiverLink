#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/backend"

python -m pip install --upgrade pip
pip install -r requirements.txt

# Train the survival model during build
echo "Training survival model..."
python -m app.ai.train_survival --data ../mock_data/patients_survival.csv --output app/ai/survival_6hr_model.pkl
echo "Model training complete."

