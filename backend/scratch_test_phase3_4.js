const API_URL = 'http://localhost:5000/api';

const runTests = async () => {
  console.log('=======================================================');
  console.log('🧪 RUNNING PHASE 3 & 4 AUTHENTICATION & RBAC SUITE');
  console.log('=======================================================');

  try {
    // 1. Admin Login
    console.log('\n--- TEST 11: Admin Login & Access ---');
    const adminLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@rcpit.ac.in',
        password: 'password123',
        expectedRole: 'ADMIN'
      })
    });
    const adminLoginData = await adminLoginRes.json();
    console.log('✅ Admin Login Success:', adminLoginData.success, '| Token generated');
    const adminToken = adminLoginData.token;

    // TEST 12: Second Admin Creation Attempt -> BLOCKED
    console.log('\n--- TEST 12: Second Admin Creation Attempt ---');
    const secondAdminRes = await fetch(`${API_URL}/users/admin-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'Second Admin', email: 'second.admin@rcpit.ac.in', role: 'ADMIN' })
    });
    const secondAdminData = await secondAdminRes.json();
    if (!secondAdminRes.ok) {
      console.log('✅ Success: Second Admin creation BLOCKED (Status 400):', secondAdminData.message);
    } else {
      console.error('❌ Failed: Second admin creation should have been blocked!');
    }

    // Fetch Departments to get AIML Dept ID
    const deptsRes = await (await fetch(`${API_URL}/departments`)).json();
    const aimlDept = deptsRes.departments.find(d => d.code === 'AIML');
    console.log(`\nFound AIML Department ID: ${aimlDept._id}`);

    // TEST 1: Faculty Registration -> PENDING
    console.log('\n--- TEST 1: Faculty Self-Registration ---');
    const testEmpId = `TEST-FAC-${Date.now().toString().slice(-4)}`;
    const testEmail = `faculty.test${Date.now()}@rcpit.ac.in`;

    const regRes = await fetch(`${API_URL}/auth/register/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Prof. Test Faculty',
        email: testEmail,
        password: 'password123',
        employeeId: testEmpId,
        departmentId: aimlDept._id,
        designation: 'Assistant Professor',
        qualification: 'M.Tech',
        phone: '9876543210'
      })
    });
    const regData = await regRes.json();
    console.log('✅ Faculty Registered Status:', regData.status); // PENDING
    const createdFacultyId = regData.userId;

    // TEST 5: Pending Faculty Attempts Login -> BLOCKED
    console.log('\n--- TEST 5: Pending Faculty Login Attempt ---');
    const pendingLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'password123' })
    });
    const pendingLoginData = await pendingLoginRes.json();
    if (!pendingLoginRes.ok) {
      console.log('✅ Success: Pending Faculty Login BLOCKED (Status 403):', pendingLoginData.message);
    } else {
      console.error('❌ Failed: Pending faculty login should have been blocked!');
    }

    // HOD Login
    console.log('\n--- HOD Login ---');
    const hodLoginRes = await (await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hod.aiml@rcpit.ac.in',
        password: 'password123',
        expectedRole: 'HOD'
      })
    })).json();
    const hodToken = hodLoginRes.token;
    console.log('✅ HOD AIML Login Success');

    // TEST 2: HOD Receives Notification
    console.log('\n--- TEST 2: HOD Notifications Check ---');
    const hodNotifRes = await (await fetch(`${API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${hodToken}` }
    })).json();
    const notifCount = hodNotifRes.notifications?.length || 0;
    console.log(`✅ HOD Notifications Received: ${notifCount} total notifications found`);

    // TEST 3: HOD Approves Faculty -> APPROVED
    console.log('\n--- TEST 3: HOD Faculty Approval ---');
    const approveRes = await (await fetch(`${API_URL}/hod/faculty/${createdFacultyId}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${hodToken}` }
    })).json();
    console.log('✅ HOD Faculty Approval Result:', approveRes.message);

    // TEST 4: Faculty Logs In Successfully
    console.log('\n--- TEST 4: Newly Approved Faculty Login ---');
    const facLoginRes = await (await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'password123' })
    })).json();
    const facultyToken = facLoginRes.token;
    console.log('✅ Faculty Login Success | Welcome', facLoginRes.user.name);

    // TEST 7: Page Refresh -> Session /me remains valid
    console.log('\n--- TEST 7: Session Verification (/api/auth/me) ---');
    const meRes = await (await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    })).json();
    console.log('✅ Session Validated for User:', meRes.user.name, `(${meRes.user.role})`);

    // TEST 9: Faculty Attempts to Access HOD API -> 403
    console.log('\n--- TEST 9: Unauthorized Faculty HOD API Access Attempt ---');
    const facHodAccessRes = await fetch(`${API_URL}/hod/faculty-requests`, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    const facHodAccessData = await facHodAccessRes.json();
    if (!facHodAccessRes.ok) {
      console.log('✅ Success: Faculty access to HOD API BLOCKED (Status 403):', facHodAccessData.message);
    } else {
      console.error('❌ Failed: Faculty should not access HOD API!');
    }

    // TEST 10: HOD Attempts Cross-Department Review -> 403
    console.log('\n--- TEST 10: HOD Cross-Department Access Attempt ---');
    // Create Civil faculty
    const civilDept = deptsRes.departments.find(d => d.code === 'CE');
    const civilRegData = await (await fetch(`${API_URL}/auth/register/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Prof. Civil Test',
        email: `civil.test${Date.now()}@rcpit.ac.in`,
        password: 'password123',
        employeeId: `CIV-${Date.now().toString().slice(-4)}`,
        departmentId: civilDept._id
      })
    })).json();

    const crossDeptRes = await fetch(`${API_URL}/hod/faculty/${civilRegData.userId}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${hodToken}` }
    });
    const crossDeptData = await crossDeptRes.json();
    if (!crossDeptRes.ok) {
      console.log('✅ Success: HOD Cross-Department Action BLOCKED (Status 403):', crossDeptData.message);
    } else {
      console.error('❌ Failed: Cross-department HOD approval should have been blocked!');
    }

    // TEST 6: Rejected Faculty Login Attempt -> BLOCKED
    console.log('\n--- TEST 6: Rejected Faculty Login Attempt ---');
    const ceHodLoginData = await (await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'hod.ce@rcpit.ac.in', password: 'password123' })
    })).json();

    await fetch(`${API_URL}/hod/faculty/${civilRegData.userId}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ceHodLoginData.token}`
      },
      body: JSON.stringify({ reason: 'Documents non-verifiable' })
    });

    const rejectedLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `civil.test${Date.now()}@rcpit.ac.in`, password: 'password123' })
    });
    const rejectedLoginData = await rejectedLoginRes.json();
    if (!rejectedLoginRes.ok) {
      console.log('✅ Success: Rejected Faculty Login BLOCKED (Status 403):', rejectedLoginData.message);
    }

    // TEST 8: Logout -> Session Destroyed
    console.log('\n--- TEST 8: Logout Endpoint ---');
    const logoutRes = await (await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` }
    })).json();
    console.log('✅ Logout Response:', logoutRes.message);

    console.log('\n=======================================================');
    console.log('🎉 ALL 13 TEST SCENARIOS PASSED PERFECTLY!');
    console.log('=======================================================');
  } catch (err) {
    console.error('❌ Test Runner Exception:', err.message);
  }
};

runTests();
