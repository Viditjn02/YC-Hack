# Visa Intelligent Commerce Setup Guide

This guide walks you through obtaining all the necessary credentials to enable Visa Intelligent Commerce in BossRoom.

## Overview

The Visa packages are already installed in the `vendor/visa-mcp` directory and linked to your project. You just need to obtain the API credentials and add them to your `.env` file.

## Prerequisites

- Node.js 18 or higher ✅ (already installed)
- Visa MCP packages ✅ (already built in vendor/visa-mcp)
- Access to Visa Developer Portal

## Step 1: Create a Visa Developer Account

1. Visit [Visa Developer Portal](https://developer.visa.com/portal)
2. Click "Sign Up" and create an account
3. Complete the registration process

## Step 2: Create a Visa Intelligent Commerce Project

1. Log in to your [Visa Developer Dashboard](https://developer.visa.com/portal)
2. Click **"Add New Project"**
3. Enter a project name (e.g., "BossRoom AI Agents")
4. Add a description
5. Select **"Visa Intelligent Commerce"** from the list of APIs
6. Choose your authentication method: **"XPay Token"** (recommended for getting started)
7. Click **"Create Project"**

## Step 3: Get VIC API Credentials

Once your project is created:

1. Navigate to your project dashboard
2. Go to the **"Credentials"** section
3. Copy the following values to your `.env` file:
   - **API Key** → `VISA_VIC_API_KEY`
   - **Shared Secret** → `VISA_VIC_API_KEY_SS`
   - **External Client ID** → `VISA_EXTERNAL_CLIENT_ID`
   - **External App ID** → `VISA_EXTERNAL_APP_ID`

## Step 4: Get VTS (Visa Token Service) Credentials

You'll need VTS credentials for card tokenization:

1. In your project dashboard, add **"Visa Token Service"** API
2. Go to the VTS credentials section
3. Copy the following:
   - **VTS API Key** → `VISA_VTS_API_KEY`
   - **VTS Shared Secret** → `VISA_VTS_API_KEY_SS`

## Step 5: Generate MLE (Message Level Encryption) Certificates

Follow the [Visa Encryption Guide](https://developer.visa.com/pages/encryption_guide):

### Quick Steps:

1. Generate a private key:
   ```bash
   openssl genrsa -out mle_private.pem 2048
   ```

2. Create a Certificate Signing Request (CSR):
   ```bash
   openssl req -new -key mle_private.pem -out mle_csr.pem
   ```

3. Submit the CSR to Visa Developer Portal:
   - Go to your project dashboard
   - Navigate to **"Encryption Keys"**
   - Upload your CSR
   - Download the server certificate

4. Add to `.env`:
   - Contents of `mle_private.pem` → `VISA_MLE_PRIVATE_KEY`
   - Downloaded certificate → `VISA_MLE_SERVER_CERT`
   - Key ID from Visa dashboard → `VISA_KEY_ID`

**Important:** Format the PEM files as single-line strings with `\n` for newlines:
```bash
# Example format:
VISA_MLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKC...\n-----END RSA PRIVATE KEY-----"
```

## Step 6: Generate Your JWT Signing Key

This is YOUR private key (not from Visa) used to sign JWTs:

```bash
# Generate RSA private key
openssl genrsa -out jwt_private.pem 2048

# Convert to PKCS#8 format (required)
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in jwt_private.pem -out jwt_private_pkcs8.pem

# View the key
cat jwt_private_pkcs8.pem
```

Add the contents of `jwt_private_pkcs8.pem` to `.env` as `USER_SIGNING_PRIVATE_KEY`

## Step 7: Verify Installation

Check that the Visa packages are properly installed:

```bash
# From BossRoom root directory
npm list @visa/mcp-client @visa/token-manager @visa/api-client
```

You should see:
```
@org/source@0.0.0
├── @visa/api-client@1.0.0 -> ./vendor/visa-mcp/packages/api-client
├── @visa/mcp-client@1.0.0 -> ./vendor/visa-mcp/packages/mcp-client
└── @visa/token-manager@1.0.0 -> ./vendor/visa-mcp/packages/token-manager
```

## Step 8: Test the Integration

Once all credentials are added to `.env`:

1. Start the game server:
   ```bash
   npm run dev:server
   ```

2. Look for the log message:
   ```
   Visa MCP client initialized (https://sandbox.mcp.visa.com)
   ```

3. If you see this instead, credentials are missing:
   ```
   VISA_VIC_API_KEY not set — Visa MCP tools disabled
   ```

## Environment Variables Checklist

Mark off each credential as you add it to `.env`:

### Required for Basic Functionality
- [ ] `VISA_VIC_API_KEY` - VIC API Key
- [ ] `VISA_VIC_API_KEY_SS` - VIC Shared Secret
- [ ] `VISA_EXTERNAL_CLIENT_ID` - External Client ID
- [ ] `VISA_EXTERNAL_APP_ID` - External App ID
- [ ] `VISA_VTS_API_KEY` - VTS API Key
- [ ] `VISA_VTS_API_KEY_SS` - VTS Shared Secret
- [ ] `VISA_MLE_SERVER_CERT` - MLE Certificate
- [ ] `VISA_MLE_PRIVATE_KEY` - MLE Private Key
- [ ] `VISA_KEY_ID` - MLE Key ID
- [ ] `USER_SIGNING_PRIVATE_KEY` - Your JWT signing key

### Optional (can be added later)
- [ ] `VISA_AUTHORIZATION` - Optional authorization header
- [ ] `VISA_RELATIONSHIP_ID` - Optional relationship ID
- [ ] `VISA_CONSUMER_ID` - Test consumer ID for workflows
- [ ] `VISA_ENROLLMENT_REFERENCE_ID` - Token reference from VTS

### Pre-configured
- [x] `VISA_MCP_BASE_URL` - Already set to sandbox URL

## Helpful Resources

- [Visa Developer Portal](https://developer.visa.com/portal)
- [Visa Intelligent Commerce Docs](https://developer.visa.com/capabilities/visa-intelligent-commerce/docs)
- [X-Pay Token Authentication Guide](https://developer.visa.com/pages/working-with-visa-apis/x-pay-token)
- [Visa Encryption Guide](https://developer.visa.com/pages/encryption_guide)
- [Visa MCP Hub](https://mcp.visa.com)
- [Local Visa Documentation](./vendor/visa-mcp/README.md)

## Troubleshooting

### "VISA_VIC_API_KEY not set"
- Check that your `.env` file has all required credentials
- Ensure there are no extra spaces around the `=` sign
- Restart your server after updating `.env`

### "Failed to initialize Visa MCP client"
- Verify your API credentials are correct
- Check that you're using the sandbox environment
- Ensure your IP is not blocked by Visa

### MLE Certificate Errors
- Verify PEM formatting (must use `\n` for line breaks)
- Check that the certificate matches the private key
- Ensure the Key ID matches what's in Visa dashboard

### JWT Signing Errors
- Verify the key is in PKCS#8 format
- Check that the PEM headers are correct
- Ensure no extra whitespace in the key

## Support

- **Visa Developer Support**: Available through the Visa Developer Portal
- **BossRoom Issues**: Check the game server logs for detailed error messages
- **Vendor Package Docs**: See `vendor/visa-mcp/README.md` for detailed package documentation

## Next Steps

Once configured, your AI agents will be able to:
- Enroll payment cards via VIC
- Create purchase instructions with user consent
- Retrieve tokenized payment credentials
- Complete secure transactions on behalf of users
- Confirm transaction outcomes

See `apps/game-server/src/ai/visa.ts` for the integration implementation.
