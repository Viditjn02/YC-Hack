# Visa Developer Portal Quick Guide

You're logged in! Here's exactly what to do next:

## 🎯 Current Step: Create Your Project

### 1. Find "Add New Project" Button
- Look in the top right or center of your dashboard
- Click **"Add New Project"** or **"Create Project"**

### 2. Fill in Project Details

```
Project Name: BossRoom AI Agents
Description: AI agent payment integration for autonomous commerce
```

### 3. Select APIs

**Required APIs:**
- ✅ **Visa Intelligent Commerce** (VIC) - Primary API for agent payments
- ✅ **Visa Token Service** (VTS) - Card tokenization

**How to add:**
- Click "Add APIs" or similar
- Search for "Visa Intelligent Commerce"
- Select it
- Search for "Visa Token Service"
- Select it

### 4. Choose Authentication

Select: **XPay Token** (API Key - Shared Secret)
- This is the simplest method
- No complex certificate setup needed initially

### 5. Create the Project

Click **"Create"** or **"Submit"**

---

## 📋 After Project Creation

### Step A: Get VIC Credentials

1. Go to your project dashboard
2. Find the **"Credentials"** tab
3. You'll see:

```
API Key: [copy this] → VISA_VIC_API_KEY
Shared Secret: [copy this] → VISA_VIC_API_KEY_SS
External Client ID: [copy this] → VISA_EXTERNAL_CLIENT_ID
External App ID: [copy this] → VISA_EXTERNAL_APP_ID
```

### Step B: Get VTS Credentials

1. In the same project, look for **"Visa Token Service"** section
2. Go to VTS **"Credentials"**
3. You'll see:

```
VTS API Key: [copy this] → VISA_VTS_API_KEY
VTS Shared Secret: [copy this] → VISA_VTS_API_KEY_SS
```

### Step C: Upload MLE Certificate Request

1. Find **"Encryption Keys"** or **"Security"** section
2. Look for **"Upload CSR"** or **"Certificate Signing Request"**
3. Upload the file: `visa-mle-csr.pem` (in your project root)
4. Visa will process it and provide:
   - **Server Certificate** (download this)
   - **Key ID** (note this down)

---

## 💻 Easy Credential Entry

Once you have all the credentials, run this helper script:

```bash
./add-visa-credentials.sh
```

It will prompt you for each credential and automatically update your `.env` file!

**Or manually update `.env`:**

```bash
# Open .env and find the VISA_ section
# Paste each credential next to its corresponding variable
nano .env
```

---

## 📝 Credentials Checklist

Track what you've copied:

**From VIC Credentials:**
- [ ] `VISA_VIC_API_KEY`
- [ ] `VISA_VIC_API_KEY_SS`
- [ ] `VISA_EXTERNAL_CLIENT_ID`
- [ ] `VISA_EXTERNAL_APP_ID`

**From VTS Credentials:**
- [ ] `VISA_VTS_API_KEY`
- [ ] `VISA_VTS_API_KEY_SS`

**From MLE/Encryption:**
- [ ] Upload `visa-mle-csr.pem`
- [ ] Download server certificate
- [ ] Note `VISA_KEY_ID`
- [ ] Add server cert to `.env` as `VISA_MLE_SERVER_CERT`

---

## 🚨 Common Issues

### "Can't find Visa Intelligent Commerce API"
- Try searching for just "Intelligent Commerce"
- Or look under "Beta APIs" or "New Products"
- Contact Visa support if still not visible

### "No Credentials tab visible"
- Make sure project creation completed successfully
- Refresh the page
- Check project status (should be "Active")

### "CSR upload failing"
- Make sure you're uploading `visa-mle-csr.pem` (not the private key)
- File should start with: `-----BEGIN CERTIFICATE REQUEST-----`
- Try different browsers if upload fails

---

## ✅ Verify Setup

Once all credentials are in `.env`:

```bash
# Test the Visa integration
npm run dev:server

# Look for this in the logs:
# ✓ Visa MCP client initialized (https://sandbox.mcp.visa.com)
```

If you see errors, check `VISA_CREDENTIALS_STATUS.md` for troubleshooting.

---

## 🆘 Need Help?

**Can't find something?**
1. Check the Visa Developer Portal docs
2. Use the portal's search function
3. Contact Visa Developer Support (in portal)

**Script not working?**
```bash
# Manually verify your credentials
cat .env | grep VISA_
```

**Still stuck?**
Open an issue or check the server logs for specific error messages.
