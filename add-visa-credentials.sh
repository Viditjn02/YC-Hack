#!/bin/bash

# Visa Credentials Helper Script
# This script helps you add Visa credentials to your .env file

echo "🔐 Visa Credentials Setup Helper"
echo "=================================="
echo ""
echo "Copy each credential from the Visa Developer Portal and paste it here."
echo "Press Ctrl+C at any time to cancel."
echo ""

# VIC API Credentials
echo "1️⃣  VIC API Credentials"
echo "   (From: Visa Intelligent Commerce > Credentials)"
echo ""
read -p "   Enter VISA_VIC_API_KEY: " VIC_API_KEY
read -p "   Enter VISA_VIC_API_KEY_SS (Shared Secret): " VIC_API_KEY_SS
echo ""

# External Client IDs
echo "2️⃣  External Client IDs"
echo "   (From: Project Dashboard > Credentials)"
echo ""
read -p "   Enter VISA_EXTERNAL_CLIENT_ID: " EXTERNAL_CLIENT_ID
read -p "   Enter VISA_EXTERNAL_APP_ID: " EXTERNAL_APP_ID
echo ""

# VTS API Credentials
echo "3️⃣  VTS API Credentials"
echo "   (From: Visa Token Service > Credentials)"
echo ""
read -p "   Enter VISA_VTS_API_KEY: " VTS_API_KEY
read -p "   Enter VISA_VTS_API_KEY_SS (Shared Secret): " VTS_API_KEY_SS
echo ""

# MLE Key ID
echo "4️⃣  MLE Key ID"
echo "   (From: Encryption Keys section - after uploading CSR)"
echo ""
read -p "   Enter VISA_KEY_ID: " KEY_ID
echo ""

echo "📝 Updating .env file..."
echo ""

# Update .env file
sed -i '' "s|^VISA_VIC_API_KEY=.*|VISA_VIC_API_KEY=$VIC_API_KEY|" .env
sed -i '' "s|^VISA_VIC_API_KEY_SS=.*|VISA_VIC_API_KEY_SS=$VIC_API_KEY_SS|" .env
sed -i '' "s|^VISA_EXTERNAL_CLIENT_ID=.*|VISA_EXTERNAL_CLIENT_ID=$EXTERNAL_CLIENT_ID|" .env
sed -i '' "s|^VISA_EXTERNAL_APP_ID=.*|VISA_EXTERNAL_APP_ID=$EXTERNAL_APP_ID|" .env
sed -i '' "s|^VISA_VTS_API_KEY=.*|VISA_VTS_API_KEY=$VTS_API_KEY|" .env
sed -i '' "s|^VISA_VTS_API_KEY_SS=.*|VISA_VTS_API_KEY_SS=$VTS_API_KEY_SS|" .env
sed -i '' "s|^VISA_KEY_ID=.*|VISA_KEY_ID=$KEY_ID|" .env

echo "✅ Credentials added to .env!"
echo ""
echo "📋 Next Steps:"
echo "1. Upload visa-mle-csr.pem to get MLE server certificate"
echo "2. Add VISA_MLE_SERVER_CERT to .env manually"
echo "3. Run: npm run dev:server"
echo ""
