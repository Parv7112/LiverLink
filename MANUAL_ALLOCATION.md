# Manual Allocation Workflow

## Overview

The system has been updated to support **manual allocation** instead of automatic SMS alerts. The AI agent now ranks patients but waits for a human coordinator to manually contact surgeons and accept allocations.

---

## Changes Made

### 1. **Agent Workflow Simplified**

**Before:**
```
fetch_patients → predict → rank → alert → evaluate
```

**After:**
```
fetch_patients → predict → rank → END
```

The agent now:
- ✅ Fetches patients from MongoDB
- ✅ Predicts 6-hour survival using ML model
- ✅ Ranks patients using multi-factor scoring
- ✅ **Stops and waits for manual action**
- ❌ No automatic SMS alerts
- ❌ No automatic allocation

---

### 2. **New API Endpoints**

#### **POST `/donors/{qr_code_id}/contact-patient`**

Send SMS to a specific patient's surgeon.

**Request:**
```json
{
  "patient_id": "P001",
  "donor_qr_code_id": "DONOR-URGENT-2024",
  "message": "URGENT: Liver available for Kevin Marshall. Please respond ASAP."
}
```

**Response:**
```json
{
  "status": "sent",
  "patient_id": "P001",
  "surgeon_phone": "+15551234567",
  "allocation_id": "6917b2665d3b1ebda84fa938",
  "message": "SMS sent successfully"
}
```

---

#### **POST `/donors/{qr_code_id}/accept-allocation`**

Manually accept allocation for a specific patient.

**Request:**
```json
{
  "patient_id": "P001",
  "allocation_id": "6917b2665d3b1ebda84fa938"
}
```

**Response:**
```json
{
  "status": "accepted",
  "patient_id": "P001",
  "patient_name": "Kevin Marshall",
  "allocation_id": "6917b2665d3b1ebda84fa938",
  "message": "Organ allocated to Kevin Marshall"
}
```

---

### 3. **Updated UI - Agent Log Page**

Each ranked patient card now includes **two action buttons**:

#### **📞 Contact Surgeon**
- Sends SMS to the patient's surgeon
- Message: "URGENT: Liver available for [Patient Name]. Please respond ASAP to confirm acceptance."
- Shows "Sending..." while processing
- Displays success/error alert

#### **✅ Accept & Allocate**
- Manually confirms allocation to this patient
- Shows confirmation dialog
- Updates allocation in database
- Marks as `accepted_manually: true`
- Refreshes UI to show accepted status
- Shows "Accepting..." while processing

---

## User Workflow

### Step 1: Register Donor & Trigger Allocation

1. Scan donor QR code
2. Fill in donor details (HLA, blood type, etc.)
3. Click **"Register & Allocate"**
4. Redirected to Agent Log page

### Step 2: Review Ranked Patients

The Agent Log shows:
- **Top 5 ranked candidates** (or all if < 5)
- **Allocation scores** (0-100) with breakdown:
  - Urgency (35%)
  - Survival (25%)
  - Immunological (12%)
  - Distance (10%)
  - Readiness (10%)
  - Risk Adjustment (8%)
- **Patient details**: MELD, survival %, HLA match, distance, hospital readiness
- **Risk factors**: HCC, Diabetes, Renal Failure, Ventilator

### Step 3: Contact Surgeon (Optional)

For each patient, you can:
1. Click **"Contact Surgeon"** button
2. SMS sent to surgeon's phone (or mocked if no Twilio)
3. Wait for surgeon response (external to system)

### Step 4: Accept Allocation

Once surgeon confirms (via phone/SMS/other):
1. Click **"Accept & Allocate"** button
2. Confirm in dialog
3. Allocation locked in database
4. UI updates to show "✓ Organ Allocated To [Patient]"

---

## Database Changes

### Allocation Memory Schema

New fields added:
```javascript
{
  _id: ObjectId,
  donor: { /* donor details */ },
  ranked_patients: [ /* top 5 patients */ ],
  accepted_patient: { /* patient data */ },  // Updated manually
  accepted_at: ISODate,                      // NEW: timestamp of acceptance
  accepted_manually: true,                   // NEW: flag for manual allocation
  timeline: [ /* events */ ],
  timestamp: ISODate
}
```

---

## Benefits of Manual Allocation

✅ **Human-in-the-loop** - Coordinator makes final decision  
✅ **Flexible communication** - Contact surgeons via SMS, phone, or other means  
✅ **No false positives** - Only allocate when surgeon explicitly confirms  
✅ **Audit trail** - All actions logged with timestamps  
✅ **Real-time updates** - WebSocket notifications on acceptance  
✅ **Better control** - Can skip patients or contact multiple surgeons  

---

## Twilio Integration

### Without Twilio (Current):
- "Contact Surgeon" button logs SMS to console
- Message: `"Mock SMS: +15551234567 -> URGENT: Liver available..."`
- Coordinator must contact surgeon manually via phone

### With Twilio (Production):
- "Contact Surgeon" button sends **real SMS**
- Surgeon receives message on phone
- Can reply or click link to confirm
- System tracks delivery status

To enable Twilio, add to `.env`:
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## Example Scenario

### Donor Registration:
```
Donor: DONOR-URGENT-2024
Organ: Liver
Blood Type: AB+
HLA: A*01:01, B*08:01, DRB1*03:01
```

### Agent Ranks 5 Patients:

| Rank | Patient | MELD | Survival | Score | Actions |
|------|---------|------|----------|-------|---------|
| 1 | Daniel Brown | 33 | 58% | 77.5 | 📞 Contact / ✅ Accept |
| 2 | Robert Morris | 40 | 33% | 74.5 | 📞 Contact / ✅ Accept |
| 3 | Trevor Diaz | 40 | 33% | 74.3 | 📞 Contact / ✅ Accept |
| 4 | Nicholas Torres | 38 | 35% | 73.7 | 📞 Contact / ✅ Accept |
| 5 | Amanda Diaz | 28 | 65% | 73.6 | 📞 Contact / ✅ Accept |

### Coordinator Actions:

1. **Reviews rankings** - Daniel Brown is top candidate
2. **Clicks "Contact Surgeon"** for Daniel Brown
3. **SMS sent** (or mocked): "URGENT: Liver available for Daniel Brown..."
4. **Calls surgeon** to confirm availability
5. **Surgeon accepts** over phone
6. **Clicks "Accept & Allocate"** for Daniel Brown
7. **Confirms** in dialog
8. **Allocation complete!** ✅

UI updates to show:
```
✓ Organ Allocated To
Daniel Brown
O- • 52 years
MELD 33 • 58% Survival • Score 77.5
```

---

## API Testing

### Contact Patient:
```bash
curl -X POST http://localhost:8000/donors/DONOR-URGENT-2024/contact-patient \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "P001",
    "donor_qr_code_id": "DONOR-URGENT-2024",
    "message": "URGENT: Liver available. Respond ASAP."
  }'
```

### Accept Allocation:
```bash
curl -X POST http://localhost:8000/donors/DONOR-URGENT-2024/accept-allocation \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "P001",
    "allocation_id": "6917b2665d3b1ebda84fa938"
  }'
```

---

## Future Enhancements

### Possible Additions:
- **SMS response webhook** - Auto-accept when surgeon replies "ACCEPT"
- **Multi-surgeon contact** - Send to multiple surgeons simultaneously
- **Timeout handling** - Auto-escalate if no response in X minutes
- **Contact history** - Track all SMS attempts per allocation
- **Surgeon preferences** - Store preferred contact methods
- **Push notifications** - Alert coordinators when surgeon responds
- **Allocation notes** - Add comments/reasons for decisions

---

## Summary

The system now provides a **hybrid AI + human workflow**:
1. **AI ranks patients** using sophisticated multi-factor scoring
2. **Human coordinator** reviews rankings and makes final decision
3. **Manual contact** via SMS or phone
4. **Explicit acceptance** required before allocation
5. **Full audit trail** of all actions

This balances **AI efficiency** with **human judgment** for critical life-or-death decisions! 🏥

