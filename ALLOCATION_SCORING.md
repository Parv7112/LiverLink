# Organ Allocation Scoring System

## Overview

The LiverLink AI agent uses a **multi-factor weighted scoring system** to rank patients on the liver transplant waitlist. This ensures fair, evidence-based allocation that balances medical urgency, survival probability, immunological compatibility, logistical feasibility, and clinical risk factors.

---

## Scoring Formula

```python
allocation_score = (
    0.35 × urgency_score +      # Medical urgency (MELD)
    0.25 × survival_score +     # 6-hour survival probability
    0.12 × immuno_score +       # Immunological compatibility
    0.10 × distance_score +     # Geographic proximity
    0.10 × readiness_score +    # Hospital readiness
    0.08 × risk_adjustment      # Clinical risk factors
)
```

**Total Weight: 100%**

---

## Scoring Components

### 1. Urgency Score (35% weight) 🚨

**What it measures:** Medical urgency based on MELD score (Model for End-Stage Liver Disease)

**Calculation:**
```python
urgency_score = meld / 40
```

**Range:** 0.0 to 1.0 (MELD 0-40)

**Why it matters:**
- Prioritizes sickest patients who need transplant most urgently
- Follows UNOS ethical guidelines for medical need
- Higher MELD = more urgent = higher score

**Example:**
- Patient with MELD 28: `28/40 = 0.70`
- Patient with MELD 15: `15/40 = 0.375`

---

### 2. Survival Score (25% weight) 💊

**What it measures:** Predicted 6-hour post-transplant survival probability

**Calculation:**
```python
survival_score = survival_6hr_prob  # Already 0-1 from ML model
```

**Range:** 0.0 to 1.0 (0% to 100% survival)

**Why it matters:**
- Ensures organ goes to patients likely to survive surgery
- Reduces organ waste from failed transplants
- Uses RandomForest ML model trained on historical outcomes

**Example:**
- Patient with 75% survival: `0.75`
- Patient with 45% survival: `0.45`

---

### 3. Immunological Score (12% weight) 🧬

**What it measures:** HLA compatibility and antibody sensitization

**Calculation:**
```python
hla_match_score = hla_match / 100
antibody_score = 1 - (hla_antibody_level / 100)
immuno_score = (hla_match_score + antibody_score) / 2
```

**Range:** 0.0 to 1.0

**Why it matters:**
- Better HLA match = lower rejection risk
- Lower antibody levels = less pre-sensitization
- Improves long-term graft survival

**Example:**
- HLA match 85%, antibody level 10%:
  - `(0.85 + 0.90) / 2 = 0.875`

---

### 4. Distance Score (10% weight) 📍

**What it measures:** Geographic proximity between donor and recipient hospital

**Calculation:**
```python
distance_score = 1 - min(distance_to_donor_km, 1000) / 1000
```

**Range:** 0.0 to 1.0 (capped at 1000km)

**Why it matters:**
- Reduces cold ischemia time (organ viability window)
- Faster transport = better outcomes
- Closer patients get priority when other factors equal

**Example:**
- Patient 50km away: `1 - 50/1000 = 0.95`
- Patient 500km away: `1 - 500/1000 = 0.50`
- Patient 1200km away: `1 - 1000/1000 = 0.0` (capped)

---

### 5. Readiness Score (10% weight) 🏥

**What it measures:** Hospital preparedness for immediate transplant

**Calculation:**
```python
icu_ready = 1.0 if icu_bed_available else 0.3
or_ready = 1.0 if or_available else 0.5
readiness_score = (icu_ready + or_ready) / 2
```

**Range:** 0.4 to 1.0

**Why it matters:**
- Ensures hospital can perform surgery immediately
- Avoids delays that waste organ viability
- ICU bed + OR availability = full readiness

**Example:**
- ICU ✓, OR ✓: `(1.0 + 1.0) / 2 = 1.0`
- ICU ✗, OR ✓: `(0.3 + 1.0) / 2 = 0.65`
- ICU ✗, OR ✗: `(0.3 + 0.5) / 2 = 0.4`

---

### 6. Risk Adjustment (8% weight) ⚠️

**What it measures:** Clinical risk factors that may complicate transplant

**Calculation:**
```python
hcc_penalty = 0.2 if hepatocellular_carcinoma else 0.0
diabetes_penalty = 0.1 if diabetes else 0.0
renal_penalty = 0.15 if renal_failure else 0.0
ventilator_penalty = 0.25 if ventilator_dependent else 0.0

total_penalty = hcc_penalty + diabetes_penalty + renal_penalty + ventilator_penalty
risk_adjustment = 1 - total_penalty
```

**Range:** 0.0 to 1.0 (lower penalties = higher score)

**Why it matters:**
- Accounts for comorbidities that affect outcomes
- Balances equity (sickest patients) with utility (best outcomes)
- Transparent penalty system for clinical factors

**Example:**
- No risk factors: `1 - 0 = 1.0`
- Diabetes only: `1 - 0.1 = 0.9`
- Diabetes + Renal failure: `1 - 0.25 = 0.75`
- HCC + Ventilator: `1 - 0.45 = 0.55`

---

## Complete Example

### Patient Profile:
```json
{
  "name": "Kevin Marshall",
  "meld": 28,
  "survival_6hr_prob": 0.75,
  "hla_match": 85,
  "hla_antibody_level": 10,
  "distance_to_donor_km": 120,
  "icu_bed_available": true,
  "or_available": true,
  "diabetes": true,
  "renal_failure": false,
  "hepatocellular_carcinoma": false,
  "ventilator_dependent": false
}
```

### Score Calculation:

1. **Urgency:** `28/40 = 0.700`
2. **Survival:** `0.75`
3. **Immuno:** `(0.85 + 0.90) / 2 = 0.875`
4. **Distance:** `1 - 120/1000 = 0.880`
5. **Readiness:** `(1.0 + 1.0) / 2 = 1.000`
6. **Risk Adj:** `1 - 0.1 = 0.900` (diabetes penalty)

### Final Score:
```
allocation_score = (
    0.35 × 0.700 +    # 0.245
    0.25 × 0.750 +    # 0.188
    0.12 × 0.875 +    # 0.105
    0.10 × 0.880 +    # 0.088
    0.10 × 1.000 +    # 0.100
    0.08 × 0.900      # 0.072
) = 0.798
```

**This patient would rank highly** (score near 0.8/1.0)

---

## Model Features

The survival prediction model uses **20 features** to estimate 6-hour survival probability:

### Core Liver Disease Markers
- `meld` - MELD score (6-40)
- `age` - Patient age
- `comorbidities` - Number of comorbid conditions
- `bilirubin` - Liver function marker
- `inr` - Coagulation measure
- `creatinine` - Kidney function
- `ascites_grade` - Fluid retention severity (0-3)
- `encephalopathy_grade` - Brain dysfunction (0-4)
- `hospitalized_last_7d` - Recent hospitalization (0/1)

### Additional Clinical Markers
- `albumin` - Protein synthesis marker
- `sodium` - Electrolyte balance
- `platelet_count` - Bleeding risk
- `child_pugh_score` - Liver disease severity (5-15)
- `hepatocellular_carcinoma` - Liver cancer (0/1)
- `diabetes` - Diabetes mellitus (0/1)
- `renal_failure` - Kidney failure (0/1)
- `ventilator_dependent` - Critical care status (0/1)

### Logistical Factors
- `distance_to_donor_km` - Geographic distance
- `icu_bed_available` - ICU readiness (0/1)

---

## Why This Approach?

### Traditional Allocation (MELD-only):
❌ Ignores survival probability  
❌ Doesn't consider logistics  
❌ No hospital readiness check  
❌ Binary HLA match (yes/no)  

### AI-Enhanced Multi-Factor Allocation:
✅ Balances urgency with outcomes  
✅ Reduces organ waste (cold ischemia)  
✅ Ensures hospital preparedness  
✅ Granular immunological scoring  
✅ Transparent risk adjustment  
✅ Full audit trail via Langfuse  

---

## Regulatory Compliance

This scoring system aligns with:
- **UNOS Policy 9.3** - Liver allocation based on medical urgency
- **OPTN Final Rule** - Equitable organ distribution
- **HIPAA** - Protected health information handling
- **21 CFR Part 11** - Electronic records and signatures

All allocation decisions are:
- **Logged** to MongoDB for audit
- **Traced** in Langfuse with full provenance
- **Explainable** with natural language reasoning
- **Reversible** (can replay decision logic)

---

## Extending the System

### Adding New Clinical Fields

1. **Update Model Features:**
```python
# backend/app/ai/survival_model.py
MODEL_FEATURES = [
    # ... existing features ...
    "new_clinical_marker",
]
```

2. **Update Patient Normalization:**
```python
# backend/app/tools/fhir_patient_tool.py
features = {
    # ... existing features ...
    "new_clinical_marker": _to_float(patient.get("new_marker"), default_value),
}
```

3. **Update Scoring Logic (Optional):**
```python
# backend/app/agents/organ_allocation_agent.py
new_factor = patient.get("new_marker") / max_value
score = (
    0.30 * urgency +
    0.20 * survival +
    # ... adjust weights ...
    0.05 * new_factor
)
```

4. **Retrain Model:**
```bash
python -m app.ai.train_survival --data patients_survival.csv
```

### Adding New Scoring Factors

Example: Add "Waitlist Priority Points"

```python
# In _rank_patients method
priority_points = patient.get("waitlist_priority_points", 0) / 100
score = (
    0.30 * urgency +
    0.20 * survival +
    0.10 * immuno_score +
    0.10 * distance +
    0.10 * readiness +
    0.08 * risk_adjustment +
    0.12 * priority_points  # NEW
)
```

---

## Monitoring & Optimization

### Key Metrics to Track:
- **Allocation Success Rate** - % of offers accepted
- **Cold Ischemia Time** - Organ viability window
- **Post-Transplant Survival** - 6hr, 30d, 1yr outcomes
- **Geographic Distribution** - Fairness across regions
- **Score Distribution** - Ensure no bias

### Langfuse Dashboards:
- View all allocation traces
- Compare scoring components across patients
- Identify bottlenecks (e.g., hospital readiness)
- A/B test scoring weight adjustments

---

## Summary

The **AI-enhanced allocation scoring system** combines:
1. **Medical urgency** (MELD) - 35%
2. **Survival prediction** (ML model) - 25%
3. **Immunological compatibility** (HLA + antibodies) - 12%
4. **Geographic proximity** (distance) - 10%
5. **Hospital readiness** (ICU + OR) - 10%
6. **Clinical risk adjustment** (comorbidities) - 8%

This creates a **fair, transparent, and optimized** allocation process that:
- Prioritizes sickest patients
- Maximizes successful outcomes
- Reduces organ waste
- Ensures hospital preparedness
- Maintains full audit compliance

**The agent orchestrates this entire workflow autonomously** while providing human-readable explanations at every step.

