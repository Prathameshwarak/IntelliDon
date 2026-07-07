async function testApi() {
  const mandalId = '8f55f103-dcc3-4972-864a-2bf06c07f549';
  const url = `http://localhost:3000/api/donations?mandal_id=${mandalId}`;
  console.log('Fetching:', url);
  try {
    const res = await fetch(url);
    const json = await res.json();
    console.log('API Response Summary:', {
      hasError: !!json.error,
      error: json.error,
      donationsCount: json.donations?.length,
      firstDonation: json.donations?.[0]
    });
  } catch (err) {
    console.error('Fetch failed:', err.message);
  }
}

testApi();
