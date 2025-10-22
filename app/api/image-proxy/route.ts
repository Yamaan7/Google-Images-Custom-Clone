import { NextRequest, NextResponse } from 'next/server';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('u');
    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter (u)' }, { status: 400, headers: CORS_HEADERS });
    }

    let parsed: URL;
    try {
        parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
    } catch (err) {
        return NextResponse.json({ error: 'Invalid url' }, { status: 400, headers: CORS_HEADERS });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    try {
        const upstream = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            // minimal UA to reduce some upstream blocks
            headers: { 'User-Agent': 'NextImageProxy/1.0 (+https://your-app)' },
        });

        clearTimeout(timeout);

        if (!upstream.ok) {
            // upstream returned error (404/403/etc) — forward status
            return NextResponse.json(
                { error: 'Upstream fetch failed', status: upstream.status, statusText: upstream.statusText },
                { status: Math.max(400, upstream.status), headers: CORS_HEADERS }
            );
        }

        const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
        const cacheControl = 'public, max-age=86400, stale-while-revalidate=604800';

        return new NextResponse(upstream.body, {
            status: 200,
            headers: {
                'content-type': contentType,
                'cache-control': cacheControl,
                ...CORS_HEADERS,
            },
        });
    } catch (err: any) {
        clearTimeout(timeout);
        const isAbort = err?.name === 'AbortError';
        return NextResponse.json(
            { error: isAbort ? 'Upstream timeout' : 'Proxy fetch error' },
            { status: 502, headers: CORS_HEADERS }
        );
    }
}