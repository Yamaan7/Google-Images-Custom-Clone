'use client';

import { useEffect, useRef, useState } from 'react';
import ImageGrid from '@/components/ImageGrid';

interface SearchItem {
  title: string;
  link: string;
  thumbnail?: string; // small preview URL (if provided by API)
}

interface SearchResponse {
  items?: any[]; // raw google items
  searchInformation?: {
    totalResults?: string;
  };
  error?: {
    message: string;
    details?: string;
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState(1); // Google start index (1-based)
  const [hasMore, setHasMore] = useState(true);
  const [totalResults, setTotalResults] = useState<number | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchResults = async (q: string, startIndex = 1, append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      // Google Custom Search caps usable start to ~100 (requests beyond that return 4xx).
      // Prevent invalid requests client-side and stop further pagination.
      if (startIndex > 100) {
        if (append) setLoadingMore(false);
        else setLoading(false);
        setHasMore(false);
        return;
      }

      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}&start=${startIndex}`);
      const data: SearchResponse = await response.json();

      if (response.ok) {
        // Map raw Google items to our SearchItem shape and prefer thumbnail when available
        const raw = data.items || [];
        const newItems: SearchItem[] = raw.map((it: any) => ({
          title: it.title,
          link: it.link,
          thumbnail: it.image?.thumbnailLink || it.thumbnail || undefined,
        }));

        setItems(prev => {
          const all = append ? [...prev, ...newItems] : newItems;
          // dedupe by link
          const seen = new Set<string>();
          return all.filter(i => {
            if (seen.has(i.link)) return false;
            seen.add(i.link);
            return true;
          });
        });

        const total = data.searchInformation?.totalResults ? parseInt(data.searchInformation.totalResults, 10) : null;
        setTotalResults(total);

        // update next start: start + number of items returned
        const nextStart = startIndex + newItems.length;
        setStart(nextStart);

        // determine if more pages available
        if (newItems.length === 0 || (total !== null && nextStart > total)) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      } else {
        setError(data.error?.details || data.error?.message || 'An unknown error occurred.');
        setHasMore(false);
      }
    } catch (err) {
      console.error("Client-side fetch error:", err);
      setError('Could not connect to the search service.');
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError(null);
    setItems([]);
    setStart(1);
    setHasMore(true);
    setTotalResults(null);
    await fetchResults(query.trim(), 1, false);
  };

  // IntersectionObserver to load more when sentinel visible
  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading && items.length > 0) {
          // load more
          fetchResults(query.trim(), start, true);
        }
      });
    }, { rootMargin: '300px' });

    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentinelRef.current, hasMore, loadingMore, loading, start, items.length, query]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-md p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between">
          <h1 className="text-2xl font-extrabold text-blue-600 mb-2 sm:mb-0">
            Image Clone
          </h1>
          <form onSubmit={handleSearch} className="flex w-full sm:w-1/2 gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for high-quality images..."
              className="flex-grow p-3 border border-gray-300 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-150"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 transition duration-150 disabled:bg-gray-400"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-6" role="alert">
            <strong className="font-bold">Search Error: </strong>
            <span className="block sm:inline">{error}</span>
            <p className="text-sm mt-1">
              Please check your API Key and CX ID in the `.env.local` file.
            </p>
          </div>
        )}

        {loading && (
          <div className="text-center p-12">
            <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-gray-600">Loading images...</p>
          </div>
        )}

        {/* ImageGrid now gets accumulated items */}
        {items.length > 0 && <ImageGrid items={items} />}

        {/* no results */}
        {!loading && items.length === 0 && (
          <div className="text-center p-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-xl">
            <p className="text-lg">No images found for "{query}". Try a different query.</p>
          </div>
        )}

        {/* sentinel for infinite scroll */}
        <div ref={sentinelRef} className="h-8" />

        {loadingMore && (
          <div className="text-center py-6 text-gray-600">Loading more images...</div>
        )}

        {!hasMore && items.length > 0 && (
          <div className="text-center py-6 text-gray-500">No more results.</div>
        )}
      </main>
    </div>
  );
}
