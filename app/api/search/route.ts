import { NextRequest, NextResponse } from 'next/server';

// Add this at the top of your route.ts file to debug
console.log('API Config:', {
    hasApiKey: !!process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
    hasCxId: !!process.env.NEXT_PUBLIC_SEARCH_ENGINE_ID
});

// Get environment variables. Note: We use process.env here as this code
// only runs on the server (in a Route Handler environment).
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const CX = process.env.NEXT_PUBLIC_SEARCH_ENGINE_ID;
const BASE_URL = 'https://www.googleapis.com/customsearch/v1';

/**
 * Handles GET requests to /api/search.
 * Fetches images from Google Custom Search API based on the query parameter 'q'.
 */
export async function GET(request: NextRequest) {
    // Verify API configuration
    if (!API_KEY || !CX) {
        console.error('Missing API configuration:', { API_KEY: !!API_KEY, CX: !!CX });
        return NextResponse.json({
            error: 'API configuration missing'
        }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json({
            error: 'Missing search query'
        }, { status: 400 });
    }

    // accept a start param for pagination (Google Custom Search is 1-based)
    const startParam = parseInt(searchParams.get('start') || '1', 10);
    const start = Number.isNaN(startParam) || startParam < 1 ? 1 : startParam;

    try {
        // Google Custom Search limits num to max 10 per request
        const url = `${BASE_URL}?key=${API_KEY}&cx=${CX}&q=${encodeURIComponent(query)}&searchType=image&imgSize=xlarge&num=10&start=${start}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error('Google API Error:', data);
            return NextResponse.json({
                error: 'Search API error',
                details: data.error?.message,
            }, { status: response.status });
        }

        // Return raw Google response — client will use items and searchInformation.totalResults
        return NextResponse.json(data);

    } catch (error) {
        console.error('Search request failed:', error);
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
}
