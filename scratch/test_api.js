const http = require('http')

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: JSON.parse(data)
        })
      })
    })

    req.on('error', (e) => {
      reject(e)
    })

    if (postData) {
      req.write(JSON.stringify(postData))
    }
    req.end()
  })
}

async function run() {
  try {
    const mandalId = '1631989d-5246-4d67-8292-8515f617b42a' // Goregaon Ganeshotsav Mandal

    console.log('\n--- Testing PATCH /api/super-admin/mandals (Suspending Mandal) ---')
    const suspendRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/super-admin/mandals',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      mandalId,
      action: 'suspend'
    })
    console.log('Suspend Status:', suspendRes.statusCode)
    console.log('Suspend Body:', JSON.stringify(suspendRes.body, null, 2))

    console.log('\n--- Testing GET /api/super-admin/mandals?status=suspended ---')
    const getSuspendedRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/super-admin/mandals?status=suspended',
      method: 'GET'
    })
    console.log('GET Suspended Status:', getSuspendedRes.statusCode)
    console.log('GET Suspended Body (Names):', getSuspendedRes.body.mandals.map(m => m.name))

    console.log('\n--- Testing PATCH /api/super-admin/mandals (Reactivating Mandal) ---')
    const reactivateRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/super-admin/mandals',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      mandalId,
      action: 'approve'
    })
    console.log('Reactivate Status:', reactivateRes.statusCode)
    console.log('Reactivate Body:', JSON.stringify(reactivateRes.body, null, 2))

    console.log('\n--- Testing GET /api/super-admin/mandals?status=active ---')
    const getActiveRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/super-admin/mandals?status=active',
      method: 'GET'
    })
    console.log('GET Active Status:', getActiveRes.statusCode)
    console.log('GET Active Body (Names):', getActiveRes.body.mandals.map(m => m.name))

  } catch (err) {
    console.error('Request failed.', err.message)
  }
}

run()
