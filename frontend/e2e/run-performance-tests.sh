#!/bin/bash

# Performance Testing Script for Adaptive Audio Recording
# This script runs the comprehensive Playwright test suite for performance scaling

echo "🎯 Starting Performance Scaling Test Suite"
echo "========================================="

# Check if Docker services are running
echo "📡 Checking Docker services..."
if ! docker-compose ps | grep -q "Up"; then
    echo "⚠️  Starting Docker services..."
    docker-compose up -d
    echo "⏳ Waiting for services to be ready..."
    sleep 30
else
    echo "✅ Docker services are running"
fi

# Install Playwright browsers if needed
echo "🌐 Installing Playwright browsers..."
npx playwright install

echo ""
echo "🧪 Running Performance Scaling Tests"
echo "===================================="

# Run performance scaling tests
echo "1️⃣ Running Performance Tier Detection Tests..."
npx playwright test e2e/tests/performance-scaling.spec.js --grep "Device Performance Tier Detection"

echo ""
echo "2️⃣ Running Dynamic Performance Scaling Tests..."
npx playwright test e2e/tests/performance-scaling.spec.js --grep "Dynamic Performance Scaling"

echo ""
echo "3️⃣ Running Frame Rate and Responsiveness Tests..."
npx playwright test e2e/tests/performance-scaling.spec.js --grep "Frame Rate and Responsiveness"

echo ""
echo "4️⃣ Running UI Components Validation Tests..."
npx playwright test e2e/tests/ui-components.spec.js

echo ""
echo "5️⃣ Running Audio Recording Quality Tests..."
npx playwright test e2e/tests/audio-recording.spec.js

echo ""
echo "6️⃣ Running Cross-Browser Compatibility Tests..."
npx playwright test e2e/tests/cross-browser.spec.js --project=chromium --project=firefox

echo ""
echo "📊 Generating Test Report..."
npx playwright show-report

echo ""
echo "✅ Performance Testing Complete!"
echo "================================"
echo ""
echo "📋 Test Summary:"
echo "• Performance tier detection across device capabilities"
echo "• Dynamic scaling during recording sessions"
echo "• UI responsiveness under performance pressure"
echo "• Audio quality adaptation based on device performance"
echo "• Cross-browser compatibility validation"
echo ""
echo "🔍 Check the HTML report for detailed results and screenshots"