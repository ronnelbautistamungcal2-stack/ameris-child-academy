#!/bin/bash
# Quick API test script

echo "=== Testing Ameris Child Academy API ==="
echo ""

# Test 1: Health Check
echo "[1] Health Check (No Auth Required)"
curl -s http://localhost:3000/api/health | jq . || echo "Failed to connect"
echo ""

# Test 2: List Users (Requires Auth)
echo "[2] List Users (Requires Token)"
echo "Note: You need to authenticate first. See TESTING_GUIDE.md for examples."
echo ""

# Test 3: Verify Database
echo "[3] Database Status"
echo "Run: npm run prisma:studio"
echo "This opens http://localhost:5555 to view/edit data"
