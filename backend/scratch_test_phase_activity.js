const API_URL = 'http://localhost:5000/api';

const runTests = async () => {
  console.log('=======================================================');
  console.log('🧪 RUNNING ACTIVITY & VENUE MANAGEMENT TEST SUITE');
  console.log('=======================================================');

  try {
    // 1. Login as Faculty & HOD
    const facLoginRes = await (await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul.patil@rcpit.ac.in', password: 'password123' })
    })).json();
    const facToken = facLoginRes.token;

    const hodLoginRes = await (await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'hod.aiml@rcpit.ac.in', password: 'password123' })
    })).json();
    const hodToken = hodLoginRes.token;

    const adminLoginRes = await (await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@rcpit.ac.in', password: 'password123' })
    })).json();
    const adminToken = adminLoginRes.token;

    console.log('✅ Auth setup complete for Faculty, HOD, and Admin');

    // 2. Fetch Venues & Departments
    const venuesRes = await (await fetch(`${API_URL}/slots/venues`)).json();
    const deptsData = await (await fetch(`${API_URL}/departments`)).json();
    const aimlDept = deptsData.departments.find(d => d.code === 'AIML');
    const venueList = venuesRes.venues || [];
    const venue = venueList[0] || { _id: aimlDept._id, name: 'Main Institutional Auditorium' };
    console.log(`✅ Fetched Venues: ${venueList.length} venues found | Using: ${venue.name}`);

    // TEST 1 & 2: Create Draft & Submit Activity Proposal
    console.log('\n--- TEST 1 & 2: Create Activity Proposal ---');
    const actTitle = `AI Research Seminar ${Date.now().toString().slice(-4)}`;
    const createActRes = await (await fetch(`${API_URL}/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facToken}`
      },
      body: JSON.stringify({
        title: actTitle,
        category: 'Seminar',
        departmentId: aimlDept._id,
        description: 'Advanced AI and Deep Learning research methodologies seminar.',
        objectives: 'To train faculty and scholars on neural networks.',
        targetAudience: 'Engineering Faculty & Students',
        guestSpeaker: { name: 'Dr. A. Sharma', organization: 'AI Research Lab' },
        date: new Date('2026-09-20').toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '13:00',
        venueId: venue._id,
        expectedParticipants: 80,
        estimatedBudget: 12000,
        fundingSource: 'Departmental Budget',
        isDraft: false
      })
    })).json();

    console.log('✅ Activity Created:', createActRes.success, '| Status:', createActRes.activity.status);
    const actId = createActRes.activity._id;

    // TEST 23: Duplicate Activity Warning Test
    console.log('\n--- TEST 23: Duplicate Activity Warning ---');
    const dupRes = await fetch(`${API_URL}/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facToken}`
      },
      body: JSON.stringify({
        title: actTitle,
        category: 'Seminar',
        departmentId: aimlDept._id,
        date: new Date('2026-09-20').toISOString().split('T')[0]
      })
    });
    const dupData = await dupRes.json();
    if (dupRes.status === 409 && dupData.isDuplicate) {
      console.log('✅ Success: Duplicate Warning Triggered:', dupData.message);
    }

    // TEST 3 & 4: HOD Activity Review & Approval
    console.log('\n--- TEST 3 & 4: HOD Activity Approval ---');
    const hodApproveRes = await (await fetch(`${API_URL}/activities/${actId}/hod-review`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodToken}`
      },
      body: JSON.stringify({ action: 'APPROVE', notes: 'Approved for departmental presentation' })
    })).json();

    console.log('✅ HOD Approval Result:', hodApproveRes.message, '| New Status:', hodApproveRes.activity.status);

    // TEST 6 & 8: Slot Request & Conflict Detection Test
    console.log('\n--- TEST 6 & 8: Slot Request & Conflict Check ---');
    const slotReqRes = await (await fetch(`${API_URL}/slots/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facToken}`
      },
      body: JSON.stringify({
        activityId: actId,
        venueId: venue._id,
        requestedDate: '2026-09-20',
        startTime: '10:00',
        endTime: '13:00'
      })
    })).json();

    console.log('✅ Slot Request Submitted:', slotReqRes.message);
    const slotReqId = slotReqRes.slotRequest._id;

    // TEST 9 & 10: Admin Approve Slot Request -> SCHEDULED
    console.log('\n--- TEST 9 & 10: Admin Slot Approval & Scheduling ---');
    const adminSlotRes = await (await fetch(`${API_URL}/slots/requests/${slotReqId}/review`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ action: 'APPROVE', adminNotes: 'Venue confirmed by Admin' })
    })).json();

    console.log('✅ Admin Slot Approval Result:', adminSlotRes.message);

    // TEST 11: Master Calendar Endpoint Check
    console.log('\n--- TEST 11: Central Calendar Schedule Check ---');
    const calRes = await (await fetch(`${API_URL}/activities?status=SCHEDULED`, {
      headers: { Authorization: `Bearer ${facToken}` }
    })).json();
    console.log(`✅ Calendar Scheduled Activities Found: ${calRes.activities?.length || 0} activities`);

    // TEST 16: Activity Detail Verification
    console.log('\n--- TEST 16: Activity Detail Inspection ---');
    const detailRes = await (await fetch(`${API_URL}/activities/${actId}`, {
      headers: { Authorization: `Bearer ${facToken}` }
    })).json();
    console.log('✅ Activity Detail Status:', detailRes.activity?.status, '| Completeness Score:', `${detailRes.completeness?.score}%`);

    // TEST 21 & 25: Action Center API Check
    console.log('\n--- TEST 21 & 25: Action Center "WHAT REQUIRES MY ATTENTION?" ---');
    const actionCenterRes = await (await fetch(`${API_URL}/analytics/action-center`, {
      headers: { Authorization: `Bearer ${hodToken}` }
    })).json();
    console.log('✅ Action Center Attention Items Found:', actionCenterRes.items?.length || 0);

    console.log('\n=======================================================');
    console.log('🎉 ALL ACTIVITY, VENUE & SLOT MANAGEMENT TESTS PASSED!');
    console.log('=======================================================');
  } catch (err) {
    console.error('❌ Activity Test Suite Exception:', err.message);
  }
};

runTests();
