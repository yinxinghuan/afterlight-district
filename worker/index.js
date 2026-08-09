const SESSION_ID = 'bed12ecd-15e6-4ba1-b1dc-a406374806b9';

export async function handleApi(request) {
  const { pathname } = new URL(request.url);

  if (request.method === 'GET' && pathname.endsWith('/api/health')) {
    return Response.json({
      ok: true,
      session_id: SESSION_ID,
      storage: 'none',
      identity_mode: 'client-only',
      release: 'guided-reveal-v1',
    });
  }

  return Response.json({ ok: false, error: 'Not Found' }, { status: 404 });
}
