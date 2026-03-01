# Visa Credentials Status

## ✅ Generated via CLI (Already in .env)

### 1. MLE Private Key - `VISA_MLE_PRIVATE_KEY` ✅
- **Status**: Generated and added to `.env`
- **Type**: RSA 2048-bit private key
- **Used for**: Message Level Encryption

### 2. JWT Signing Key - `USER_SIGNING_PRIVATE_KEY` ✅
- **Status**: Generated and added to `.env`
- **Type**: RSA 2048-bit PKCS#8 private key
- **Used for**: Signing JWTs before encryption

### 3. MLE Certificate Signing Request (CSR) ✅
- **Status**: Generated and saved to `visa-mle-csr.pem`
- **Next Step**: Upload this to Visa Developer Portal to get the server certificate
- **Location**: `./visa-mle-csr.pem`

## ❌ Must Get from Visa Developer Portal

These credentials **CANNOT** be generated via CLI. You must get them from https://developer.visa.com/portal:

### 1. VIC API Credentials
- [ ] `VISA_VIC_API_KEY` - From your VIC project dashboard
- [ ] `VISA_VIC_API_KEY_SS` - Shared secret for VIC API

### 2. Client Identification
- [ ] `VISA_EXTERNAL_CLIENT_ID` - External client identifier
- [ ] `VISA_EXTERNAL_APP_ID` - External application identifier

### 3. VTS API Credentials
- [ ] `VISA_VTS_API_KEY` - From your VTS project dashboard
- [ ] `VISA_VTS_API_KEY_SS` - Shared secret for VTS API

### 4. MLE Server Certificate
- [ ] `VISA_MLE_SERVER_CERT` - Upload `visa-mle-csr.pem` to Visa portal, download certificate
- [ ] `VISA_KEY_ID` - Key identifier from Visa dashboard

## 📋 Step-by-Step: Get Visa Credentials

### Step 1: Create Visa Developer Account
```bash
# Open in browser:
open https://developer.visa.com/portal
# Or manually visit: https://developer.visa.com/portal
```
- Sign up for an account
- Verify your email

### Step 2: Create a VIC Project
1. Click "Add New Project"
2. Name: "BossBot AI Agents"
3. Select "Visa Intelligent Commerce"
4. Choose authentication: "XPay Token"
5. Click "Create Project"

### Step 3: Get API Credentials
In your project dashboard:
1. Go to "Credentials" section
2. Copy these values to `.env`:
   - API Key → `VISA_VIC_API_KEY`
   - Shared Secret → `VISA_VIC_API_KEY_SS`
   - External Client ID → `VISA_EXTERNAL_CLIENT_ID`
   - External App ID → `VISA_EXTERNAL_APP_ID`

### Step 4: Add VTS API
1. In same project, add "Visa Token Service" API
2. Get VTS credentials:
   - VTS API Key → `VISA_VTS_API_KEY`
   - VTS Shared Secret → `VISA_VTS_API_KEY_SS`

### Step 5: Upload CSR for MLE Certificate
1. In project dashboard, go to "Encryption Keys"
2. Upload the file: `visa-mle-csr.pem`
3. Download the server certificate Visa provides
4. Convert the certificate to single-line format:
   ```bash
   # Format the certificate (replace with your downloaded cert file):
   awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' downloaded_cert.pem
   ```
5. Add to `.env`:
   - Formatted certificate → `VISA_MLE_SERVER_CERT`
   - Key ID from dashboard → `VISA_KEY_ID`

## 🔍 Quick Verification

Check what's missing:
```bash
# Check which credentials are empty
grep "^VISA_.*=$" .env
grep "^USER_SIGNING_PRIVATE_KEY=$" .env
```

Check what's set:
```bash
# Check which credentials are filled
grep "^VISA_.*=." .env | grep -v "^VISA_.*=$"
```

## 🧪 Test the Setup

Once all credentials are added:

```bash
# Start the server
npm run dev:server

# Look for this success message:
# "Visa MCP client initialized (https://sandbox.mcp.visa.com)"

# If you see this, credentials are missing:
# "VISA_VIC_API_KEY not set — Visa MCP tools disabled"
```

## 📁 Files Created

- ✅ `.env` - Updated with generated keys
- ✅ `visa-mle-csr.pem` - Certificate signing request (upload to Visa)
- ✅ `VISA_SETUP.md` - Detailed setup guide
- ✅ `VISA_CREDENTIALS_STATUS.md` - This file

## 🗑️ Cleanup

The temporary key files are in `/tmp/visa-certs/` and can be deleted after setup:
```bash
# Optional: Remove temp files (keys are already in .env)
rm -rf /tmp/visa-certs/
```

## ⏱️ Time Estimate

- Creating Visa account: 5 minutes
- Creating project & getting credentials: 10 minutes
- Uploading CSR & getting certificate: 5 minutes
- **Total: ~20 minutes**

## 🆘 Support

If you get stuck:
1. Check `VISA_SETUP.md` for detailed instructions
2. Visit Visa Developer Portal support
3. Check server logs for specific error messages
