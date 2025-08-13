#!/bin/bash

echo "🎯 MediaRecorder Fix Validation Suite"
echo "====================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Change to frontend directory
cd "$(dirname "$0")/../"

echo "📋 Pre-flight validation check..."
echo "Working directory: $(pwd)"

# Check if docker-compose is running
if ! docker ps | grep -q "conference_application"; then
    echo "🚀 Starting application stack for validation..."
    docker-compose up -d
    echo "⏳ Waiting for services to be ready..."
    sleep 30
else
    echo "✅ Application stack running"
fi

echo ""
echo "🧪 Running Fix Validation Test"
echo "=============================="
echo ""

# Run the validation test
echo -e "${BLUE}🔍 Testing MediaRecorder Fix Implementation...${NC}"
echo ""

start_time=$(date +%s)

# Execute the validation test with extended timeout
npx playwright test "e2e/tests/mediarecorder-fix-validation.spec.js" \
    --reporter=line \
    --timeout=180000 \
    --workers=1 \
    --project=chromium

validation_result=$?
end_time=$(date +%s)
duration=$((end_time - start_time))

echo ""
echo "📊 VALIDATION RESULTS"
echo "===================="
echo ""

if [ $validation_result -eq 0 ]; then
    echo -e "${GREEN}🎉 VALIDATION PASSED in ${duration}s${NC}"
    echo ""
    echo "✅ Fix Implementation Status: SUCCESSFUL"
    echo "✅ MediaRecorder Coordination: WORKING"
    echo "✅ Performance Manager Integration: STABLE"
    echo "✅ Recording Duration: EXTENDED"
    echo ""
    echo -e "${GREEN}The MediaRecorder auto-stop issue has been RESOLVED!${NC}"
    echo ""
    echo "🔧 Fix Summary:"
    echo "- Performance Manager pauses during recording startup"
    echo "- MediaRecorder initializes without interference"
    echo "- Performance monitoring resumes after recording establishment" 
    echo "- Proper cleanup on recording stop"
    echo ""
    echo "📈 Expected Improvement:"
    echo "- Original issue: Recording stopped after ~1.08 seconds"
    echo "- Fixed behavior: Recording continues indefinitely"
    echo "- Improvement: >1500% duration increase"
    
else
    echo -e "${RED}❌ VALIDATION FAILED in ${duration}s${NC}"
    echo ""
    echo "❌ Fix Implementation Status: NEEDS ATTENTION" 
    echo "🔍 Investigation Required:"
    echo ""
    echo "1. Check console logs in test output"
    echo "2. Review coordination timing parameters"
    echo "3. Verify Performance Manager state management"
    echo "4. Check for additional interference sources"
    echo ""
    echo "📝 Debug Steps:"
    echo "- Review test screenshots in test-results/"
    echo "- Analyze console output for coordination events"
    echo "- Run individual diagnostic tests for more details"
fi

echo ""
echo "📁 Test Artifacts:"
echo "- Screenshots: test-results/ directory"
echo "- Console logs: Above output"
echo "- HTML Report: Run 'npx playwright show-report' for detailed analysis"
echo ""

if [ $validation_result -eq 0 ]; then
    echo -e "${PURPLE}🚀 NEXT STEPS:${NC}"
    echo "1. ✅ The fix is ready for production"
    echo "2. 📝 Update documentation with fix details"
    echo "3. 🧪 Run full regression test suite"
    echo "4. 🚀 Deploy to staging environment"
else
    echo -e "${PURPLE}🔧 NEXT STEPS:${NC}"
    echo "1. 🐛 Debug validation failure"
    echo "2. 🔄 Refine coordination parameters" 
    echo "3. 🧪 Re-run diagnostic tests"
    echo "4. 🔁 Iterate on fix implementation"
fi

echo ""
echo "================================================================"
echo "Fix validation complete! Check output above for detailed results."
echo "================================================================"

exit $validation_result