const http = require('http');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function request(method, path, body, uid) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-user-uid': uid,
                'Authorization': 'Bearer mock-token'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch(e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log("Starting User Data Isolation Regression Tests...\n");
    let passed = 0;
    let failed = 0;

    const assert = (condition, message) => {
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${message}`);
            failed++;
        }
    };

    // SETUP
    const USER_A = 'test-user-a';
    const USER_B = 'test-user-b';

    // 1. Initial Sync for User A
    let resA = await request('POST', '/api/sync', {
        transactions: [{ id: 'tx_A1', amount: 5000 }],
        tasks: [{ id: 'task_A1', title: 'User A Task' }]
    }, USER_A);
    assert(resA.status === 200, "User A successfully synced initial data");

    // 2. Fetch User A profile
    let getA = await request('GET', '/api/sync', null, USER_A);
    assert(getA.data.data.transactions[0].id === 'tx_A1', "User A can read their own transactions");

    // 3. User B fetches data (No Family yet)
    let getB = await request('GET', '/api/sync', null, USER_B);
    assert(!getB.data.data.transactions, "User B does NOT see User A's transactions");

    // 4. Create Family for User A
    let famA = await request('GET', '/api/family', null, USER_A);
    assert(famA.data.success && famA.data.family.ownerUid === USER_A, "User A family created");
    const familyId = famA.data.family.familyId;

    // 5. Add Member B to Family A
    let addMem = await request('POST', '/api/family/members', {
        name: 'User B',
        relationship: 'Test'
    }, USER_A);
    const inviteToken = addMem.data.member.inviteToken;
    const memberId = addMem.data.member.memberId;

    // 6. User B accepts invite securely
    let acceptRes = await request('POST', '/api/family/accept-invite', {
        inviteToken
    }, USER_B);
    if (!(acceptRes.status === 200 && acceptRes.data.member.firebaseUid === USER_B)) {
        console.error("acceptRes failed:", acceptRes);
    }
    assert(acceptRes.status === 200 && acceptRes.data.member.firebaseUid === USER_B, "User B securely joined User A's family");

    // 7. Test Cross-Tenant Overwrite Leak
    // User A syncs again with highly sensitive data
    await request('POST', '/api/sync', {
        transactions: [{ id: 'tx_SECRET_A', amount: 999999 }],
        bank_statements: [{ id: 'stmt_A', balance: 1000000 }],
        tasks: [{ id: 'shared_task_1', title: 'Buy Groceries' }]
    }, USER_A);

    // 8. User B fetches sync data
    let getB_Family = await request('GET', '/api/sync', null, USER_B);
    
    // VERIFY: Did User A's private transactions leak to User B?
    assert(!getB_Family.data.data.transactions || getB_Family.data.data.transactions[0].id !== 'tx_SECRET_A', 
        "CRITICAL FIX VERIFIED: User B cannot see User A's private transactions via family sync.");
    
    assert(!getB_Family.data.data.bank_statements, 
        "CRITICAL FIX VERIFIED: User B cannot see User A's bank statements via family sync.");

    assert(getB_Family.data.data.tasks[0].id === 'shared_task_1', 
        "FEATURE WORKING: User B CAN see allowed shared data (tasks) from User A.");

    // 9. Test Broken Access Control in invite acceptance (Attacker trying to use arbitrary targetUid without token)
    let badAcceptRes = await request('POST', '/api/family/accept-invite', {
        inviteToken: 'some-fake-token',
        targetUid: 'victim-uid'
    }, 'attacker-uid');
    
    // Because attacker-uid token evaluates to { uid: 'attacker-uid' }, the endpoint no longer falls back to trusting `targetUid: 'victim-uid'`
    assert(badAcceptRes.status === 404 || badAcceptRes.data.member?.firebaseUid !== 'victim-uid', 
        "SECURITY FIX VERIFIED: /api/family/accept-invite no longer trusts unauthenticated targetUid.");


    // 10. Statement Parse API Authentication
    let statementResUnauth = await new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: '/api/statement/parse',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        const r = http.request(options, (res) => resolve(res.statusCode));
        r.write(JSON.stringify({ fileName: 'test.pdf' }));
        r.end();
    });
    assert(statementResUnauth === 401, "SECURITY FIX VERIFIED: /api/statement/parse blocks unauthenticated requests.");


    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
