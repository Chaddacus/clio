#!/bin/bash

echo "🎯 MediaRecorder Fix Test Suite - Rapid Diagnostic"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to run a single test
run_test() {
    local test_file=$1
    local test_name=$2
    local expected_duration=$3
    
    echo -e "${BLUE}Running Test: ${test_name}${NC}"
    echo "Expected duration: ${expected_duration}"
    echo "----------------------------------------"
    
    start_time=$(date +%s)
    
    # Run the test
    npx playwright test "$test_file" --reporter=line --timeout=120000
    result=$?
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    if [ $result -eq 0 ]; then
        echo -e "${GREEN}✅ Test PASSED in ${duration}s${NC}"
    else
        echo -e "${RED}❌ Test FAILED in ${duration}s${NC}"
    fi
    
    echo ""
    return $result
}

# Change to frontend directory
cd "$(dirname "$0")/../"

echo "📋 Pre-flight check..."
echo "Working directory: $(pwd)"

# Check if docker-compose is running
if ! docker ps | grep -q "conference_application"; then
    echo "🚀 Starting application stack..."
    docker-compose up -d
    echo "⏳ Waiting for services to be ready..."
    sleep 30
else
    echo "✅ Application stack already running"
fi

echo ""
echo "🧪 Starting Test Sequence"
echo "========================"
echo ""

# Test 1: Performance Manager Disable (Expected: 3-5 min)
run_test "e2e/tests/mediarecorder-fix-test-1-disable-performance.spec.js" "Performance Manager Disable" "3-5 min"
test1_result=$?

# Test 2: Delayed Performance Monitoring (Expected: 3-5 min)  
run_test "e2e/tests/mediarecorder-fix-test-2-delayed-performance.spec.js" "Delayed Performance Monitoring" "3-5 min"
test2_result=$?

# Test 3: Performance Manager Pause (Expected: 3-5 min)
run_test "e2e/tests/mediarecorder-fix-test-3-pause-performance.spec.js" "Performance Manager Pause" "3-5 min" 
test3_result=$?

# Test 4: Minimal Recorder (Expected: 2-3 min)
run_test "e2e/tests/mediarecorder-fix-test-4-minimal-recorder.spec.js" "Minimal Recorder Implementation" "2-3 min"
test4_result=$?

# Analysis
echo "🔍 TEST SUITE ANALYSIS"
echo "======================"
echo ""

total_tests=4
passed_tests=0
[ $test1_result -eq 0 ] && ((passed_tests++))
[ $test2_result -eq 0 ] && ((passed_tests++))
[ $test3_result -eq 0 ] && ((passed_tests++))
[ $test4_result -eq 0 ] && ((passed_tests++))

echo "Test Results Summary:"
echo "- Test 1 (Disable Performance): $([ $test1_result -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "- Test 2 (Delay Performance): $([ $test2_result -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "- Test 3 (Pause Performance): $([ $test3_result -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "- Test 4 (Minimal Recorder): $([ $test4_result -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo ""
echo "Overall: ${passed_tests}/${total_tests} tests passed"
echo ""

# Diagnosis based on results
echo "🏥 DIAGNOSTIC INTERPRETATION"
echo "============================"
echo ""

if [ $test4_result -eq 0 ]; then
    echo -e "${GREEN}✅ Minimal recorder works - confirms application-level interference${NC}"
    
    if [ $test1_result -eq 0 ]; then
        echo -e "${GREEN}✅ Disabling Performance Manager fixes the issue${NC}"
        echo -e "${BLUE}🎯 DIAGNOSIS: Performance Manager is the primary culprit${NC}"
        echo ""
        echo "RECOMMENDED FIX:"
        echo "1. Implement performance manager coordination in useAudioRecorder"
        echo "2. Pause performance monitoring during recording startup"
        echo "3. Resume monitoring after recording is established"
        
    elif [ $test2_result -eq 0 ]; then
        echo -e "${YELLOW}⚠️ Delaying Performance Manager helps${NC}"
        echo -e "${BLUE}🎯 DIAGNOSIS: Timing conflict between Performance Manager and MediaRecorder${NC}"
        echo ""
        echo "RECOMMENDED FIX:"
        echo "1. Delay performance monitoring until after recording starts"
        echo "2. Implement proper coordination between features"
        
    elif [ $test3_result -eq 0 ]; then
        echo -e "${GREEN}✅ Pausing Performance Manager during recording works${NC}"
        echo -e "${BLUE}🎯 DIAGNOSIS: Performance monitoring interferes with active recording${NC}"
        echo ""
        echo "RECOMMENDED FIX:"
        echo "1. Pause performance manager before starting recording"
        echo "2. Resume after recording establishment period"
        
    else
        echo -e "${RED}❌ Performance Manager coordination attempts failed${NC}"
        echo -e "${BLUE}🎯 DIAGNOSIS: Complex interaction between multiple features${NC}"
        echo ""
        echo "RECOMMENDED FIX:"
        echo "1. Implement minimal recording mode without performance features"
        echo "2. Progressive feature addition with proper coordination"
    fi
    
else
    echo -e "${RED}❌ Even minimal recorder fails - deeper browser/system issue${NC}"
    echo -e "${BLUE}🎯 DIAGNOSIS: Fundamental MediaRecorder or browser compatibility problem${NC}"
    echo ""
    echo "RECOMMENDED INVESTIGATION:"
    echo "1. Check browser permissions and hardware access"
    echo "2. Test in different browsers"  
    echo "3. Verify MediaRecorder support and constraints"
fi

echo ""
echo "🎬 Next Steps:"
echo "1. Review test outputs and screenshots in test-results/"
echo "2. Implement the recommended fix"
echo "3. Run validation tests"
echo ""
echo "Test suite complete! Check individual test outputs for detailed logs."