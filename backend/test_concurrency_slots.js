const BASE_URL = 'http://127.0.0.1:5000/api';
const results = [];

function recordTest(testName, passed, details = '') {
  results.push({ testName, passed, details });
  console.log(`[TEST] ${testName}: ${passed ? '✅ PASSED' : '❌ FAILED'} ${details ? '(' + details + ')' : ''}`);
}

async function runConcurrencyAndConflictTests() {
  console.log('===========================================================');
  console.log('🚀 STARTING REAL-DATABASE VENUE CONFLICT & FCFS CONCURRENCY TEST SUITE');
  console.log('===========================================================');

  try {
    // 1. Reset Test Database via route
    const resetRes = await fetch(`${BASE_URL}/auth/test-reset`, { method: 'POST' }).then(r => r.json());
    console.log('[Setup] DB Reset:', resetRes.message);

    // 2. Admin Login
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@rcpit.ac.in', password: 'Admin@rcpit2026' })
    }).then(r => r.json());

    const adminToken = adminLoginRes.token;
    const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };

    // Fetch Departments (AIML and CE)
    const deptsRes = await fetch(`${BASE_URL}/departments`, { headers: adminHeaders }).then(r => r.json());
    const aimlDept = deptsRes.departments?.find(d => d.code === 'AIML');
    const ceDept = deptsRes.departments?.find(d => d.code === 'CE');

    // Provision Faculty AIML
    const facAimlRes = await fetch(`${BASE_URL}/users/faculty`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        employeeId: 'RCPIT-FAC-AIML-101',
        name: 'Prof. AIML Coordinator',
        email: 'fac.aiml@rcpit.ac.in',
        password: 'Faculty@rcpit123',
        departmentId: aimlDept._id,
        designation: 'Assistant Professor'
      })
    }).then(r => r.json());

    // Provision Faculty CE (different department)
    const facCeRes = await fetch(`${BASE_URL}/users/faculty`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        employeeId: 'RCPIT-FAC-CE-102',
        name: 'Prof. CE Coordinator',
        email: 'fac.ce@rcpit.ac.in',
        password: 'Faculty@rcpit123',
        departmentId: ceDept._id,
        designation: 'Assistant Professor'
      })
    }).then(r => r.json());

    // Faculty AIML Login
    const aimlLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'RCPIT-FAC-AIML-101', password: 'Faculty@rcpit123' })
    }).then(r => r.json());

    const aimlToken = aimlLogin.token;
    const aimlHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${aimlToken}` };

    // Faculty CE Login
    const ceLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'RCPIT-FAC-CE-102', password: 'Faculty@rcpit123' })
    }).then(r => r.json());

    const ceToken = ceLogin.token;
    const ceHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${ceToken}` };

    // Create 2 Physical Venues: Auditorium Block A & Block B
    const venueARes = await fetch(`${BASE_URL}/slots/venues`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: 'Auditorium Block A', code: 'AUD-A', capacity: 300, location: 'Block A' })
    }).then(r => r.json());

    const venueBRes = await fetch(`${BASE_URL}/slots/venues`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: 'Auditorium Block B', code: 'AUD-B', capacity: 200, location: 'Block B' })
    }).then(r => r.json());

    const venueAId = venueARes.venue._id;
    const venueBId = venueBRes.venue._id;

    // Create Base Activity for AIML
    const actAimlRes = await fetch(`${BASE_URL}/activities`, {
      method: 'POST',
      headers: aimlHeaders,
      body: JSON.stringify({
        title: 'AIML Anchor Workshop',
        category: 'Workshop',
        departmentId: aimlDept._id,
        description: 'Base activity for venue conflict testing',
        date: '2026-10-20',
        startTime: '10:00',
        endTime: '12:00',
        venueId: venueAId
      })
    }).then(r => r.json());

    const actAimlId = actAimlRes.activity?._id;
    console.log('[Setup Base Activity]:', JSON.stringify(actAimlRes));

    console.log('\n--- PART 1: INTERVAL OVERLAP & WORKFLOW TEST CASES ---');

    // TEST 1: Same Venue + Same Time Range (10:00-12:00 vs 10:00-12:00) -> CONFLICT
    const test1Res = await fetch(`${BASE_URL}/slots/availability?venueId=${venueAId}&date=2026-10-20&startTime=10:00&endTime=12:00`, { headers: aimlHeaders });
    const test1Data = await test1Res.json();
    recordTest(
      'TEST 1: Same Venue + Exact Same Time (10:00-12:00 vs 10:00-12:00)',
      test1Res.status === 409 && test1Data.code === 'SLOT_ALREADY_BOOKED',
      `HTTP Status: ${test1Res.status}, Message: "${test1Data.message}"`
    );

    // TEST 2: Same Venue + Overlapping Start (11:00-13:00 vs 10:00-12:00) -> CONFLICT
    const test2Res = await fetch(`${BASE_URL}/slots/availability?venueId=${venueAId}&date=2026-10-20&startTime=11:00&endTime=13:00`, { headers: aimlHeaders });
    const test2Data = await test2Res.json();
    recordTest(
      'TEST 2: Same Venue + Overlapping Start (11:00-13:00)',
      test2Res.status === 409 && test2Data.code === 'SLOT_ALREADY_BOOKED',
      `HTTP Status: ${test2Res.status}`
    );

    // TEST 3: Same Venue + Overlapping End (09:00-11:00 vs 10:00-12:00) -> CONFLICT
    const test3Res = await fetch(`${BASE_URL}/slots/availability?venueId=${venueAId}&date=2026-10-20&startTime=09:00&endTime=11:00`, { headers: aimlHeaders });
    const test3Data = await test3Res.json();
    recordTest(
      'TEST 3: Same Venue + Overlapping End (09:00-11:00)',
      test3Res.status === 409 && test3Data.code === 'SLOT_ALREADY_BOOKED',
      `HTTP Status: ${test3Res.status}`
    );

    // TEST 4: Same Venue + Sub-interval (11:30-12:30 vs 10:00-12:00) -> CONFLICT
    const test4Res = await fetch(`${BASE_URL}/slots/availability?venueId=${venueAId}&date=2026-10-20&startTime=11:30&endTime=12:30`, { headers: aimlHeaders });
    const test4Data = await test4Res.json();
    recordTest(
      'TEST 4: Same Venue + Sub-interval Overlap (11:30-12:30)',
      test4Res.status === 409 && test4Data.code === 'SLOT_ALREADY_BOOKED',
      `HTTP Status: ${test4Res.status}`
    );

    // TEST 5: Adjacent End-to-Start (12:00-14:00 vs 10:00-12:00) -> ALLOWED
    const test5Res = await fetch(`${BASE_URL}/slots/availability?venueId=${venueAId}&date=2026-10-20&startTime=12:00&endTime=14:00`, { headers: aimlHeaders });
    const test5Data = await test5Res.json();
    recordTest(
      'TEST 5: Same Venue + Adjacent End-to-Start (12:00-14:00)',
      test5Res.status === 200 && test5Data.available === true,
      `HTTP Status: ${test5Res.status}, Available: ${test5Data.available}`
    );

    // TEST 6: Adjacent Start-to-End (08:00-10:00 vs 10:00-12:00) -> ALLOWED
    const test6Res = await fetch(`${BASE_URL}/slots/availability?venueId=${venueAId}&date=2026-10-20&startTime=08:00&endTime=10:00`, { headers: aimlHeaders });
    const test6Data = await test6Res.json();
    recordTest(
      'TEST 6: Same Venue + Adjacent Start-to-End (08:00-10:00)',
      test6Res.status === 200 && test6Data.available === true,
      `HTTP Status: ${test6Res.status}, Available: ${test6Data.available}`
    );

    // TEST 7: Different Venue + Same Date/Time -> ALLOWED
    const test7Res = await fetch(`${BASE_URL}/slots/availability?venueId=${venueBId}&date=2026-10-20&startTime=10:00&endTime=12:00`, { headers: aimlHeaders });
    const test7Data = await test7Res.json();
    recordTest(
      'TEST 7: Different Venue + Same Date/Time (Auditorium B)',
      test7Res.status === 200 && test7Data.available === true,
      `HTTP Status: ${test7Res.status}`
    );

    // TEST 8: Same Venue + Different Date -> ALLOWED
    const test8Res = await fetch(`${BASE_URL}/slots/availability?venueId=${venueAId}&date=2026-10-21&startTime=10:00&endTime=12:00`, { headers: aimlHeaders });
    const test8Data = await test8Res.json();
    recordTest(
      'TEST 8: Same Venue + Different Date (2026-10-21)',
      test8Res.status === 200 && test8Data.available === true,
      `HTTP Status: ${test8Res.status}`
    );

    // TEST 9: Cross-Department Physical Venue Conflict (CE tries Auditorium A at 10:00-12:00) -> CONFLICT
    const test9Res = await fetch(`${BASE_URL}/activities`, {
      method: 'POST',
      headers: ceHeaders,
      body: JSON.stringify({
        title: 'CE Department Conflicting Activity',
        category: 'Seminar',
        departmentId: ceDept._id,
        description: 'Cross department conflict attempt',
        date: '2026-10-20',
        startTime: '10:00',
        endTime: '12:00',
        venueId: venueAId
      })
    });
    const test9Data = await test9Res.json();
    recordTest(
      'TEST 9: Cross-Department Physical Venue Conflict Prevention',
      test9Res.status === 409 && test9Data.code === 'SLOT_ALREADY_BOOKED',
      `HTTP Status: ${test9Res.status}, Message: "${test9Data.message}"`
    );

    // Create Base Activity for CE
    const actCeRes = await fetch(`${BASE_URL}/activities`, {
      method: 'POST',
      headers: ceHeaders,
      body: JSON.stringify({
        title: 'CE Candidate Activity',
        category: 'Seminar',
        departmentId: ceDept._id,
        description: 'CE activity for conflict check',
        date: '2026-10-20',
        startTime: '14:00',
        endTime: '16:00'
      })
    }).then(r => r.json());

    const actCeId = actCeRes.activity._id;

    // TEST 10: Direct Slot Request Creation Conflict Rejection
    const test10Res = await fetch(`${BASE_URL}/slots/requests`, {
      method: 'POST',
      headers: ceHeaders,
      body: JSON.stringify({
        activityId: actCeId,
        venueId: venueAId,
        requestedDate: '2026-10-20',
        startTime: '10:30',
        endTime: '11:30'
      })
    });
    const test10Data = await test10Res.json();
    recordTest(
      'TEST 10: Direct Slot Request Creation Conflict Rejection',
      test10Res.status === 409 && test10Data.code === 'SLOT_ALREADY_BOOKED',
      `HTTP Status: ${test10Res.status}, Message: "${test10Data.message}"`
    );


    console.log('\n--- PART 2: MANDATORY CONCURRENT BURST FCFS TEST ---');

    // Create 10 different target activities for the burst test
    const burstActPromises = Array.from({ length: 10 }).map((_, i) =>
      fetch(`${BASE_URL}/activities`, {
        method: 'POST',
        headers: aimlHeaders,
        body: JSON.stringify({
          title: `Concurrent Burst Candidate ${i + 1}`,
          category: 'Workshop',
          departmentId: aimlDept._id,
          description: `Burst candidate ${i + 1}`,
          date: '2026-11-15',
          startTime: '14:00',
          endTime: '17:00'
        })
      }).then(r => r.json())
    );

    const burstActs = await Promise.all(burstActPromises);
    const burstActIds = burstActs.map(a => a.activity._id);

    console.log(`[Burst Setup] 10 Activities created. Firing 10 SIMULTANEOUS slot booking requests...`);

    // Fire 10 simultaneous slot booking requests for exact same venue (Auditorium A) and time (14:00-17:00 on 2026-11-15)
    const concurrentRequests = burstActIds.map((actId, index) =>
      fetch(`${BASE_URL}/slots/requests`, {
        method: 'POST',
        headers: aimlHeaders,
        body: JSON.stringify({
          activityId: actId,
          venueId: venueAId,
          requestedDate: '2026-11-15',
          startTime: '14:00',
          endTime: '17:00'
        })
      }).then(async (res) => ({
        index: index + 1,
        status: res.status,
        data: await res.json()
      }))
    );

    const burstResults = await Promise.all(concurrentRequests);

    let successCount = 0;
    let conflictCount = 0;
    let otherCount = 0;

    burstResults.forEach((r) => {
      if (r.status === 201 || r.status === 200) {
        successCount++;
        console.log(`  -> Request #${r.index}: SUCCESS (HTTP ${r.status})`);
      } else if (r.status === 409 && r.data.code === 'SLOT_ALREADY_BOOKED') {
        conflictCount++;
        console.log(`  -> Request #${r.index}: REJECTED CONFLICT (HTTP 409) - "${r.data.message}"`);
      } else {
        otherCount++;
        console.log(`  -> Request #${r.index}: OTHER (HTTP ${r.status}) - "${r.data.message}"`);
      }
    });

    console.log(`\n[Burst Test Invariant Summary]`);
    console.log(`   SUCCESS COUNT  : ${successCount} (Required: EXACTLY 1)`);
    console.log(`   CONFLICT COUNT : ${conflictCount} (Required: EXACTLY 9)`);
    console.log(`   OTHER COUNT    : ${otherCount} (Required: 0)`);

    const isBurstInvariantSatisfied = (successCount === 1) && (conflictCount === 9) && (otherCount === 0);

    recordTest(
      'MANDATORY CONCURRENCY BURST TEST (10 Concurrent Requests -> 1 Winner, 9 Conflicts)',
      isBurstInvariantSatisfied,
      `Success: ${successCount}, Conflicts: ${conflictCount}`
    );

    console.log('===========================================================');
    const allPassed = results.every(r => r.passed);
    console.log(`🎉 CONFLICT & CONCURRENCY TEST SUITE: ${allPassed ? 'ALL TESTS PASSED 100%!' : 'SOME TESTS FAILED'}`);
    console.log('===========================================================');

  } catch (err) {
    console.error('❌ Test Suite Fatal Error:', err);
  }
}

runConcurrencyAndConflictTests();
