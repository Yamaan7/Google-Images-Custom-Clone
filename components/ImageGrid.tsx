'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

// Define the shape of a single image result item
interface ImageResult {
    title: string;
    link: string; // The high-quality image URL
    thumbnail?: string; // small preview URL (if available)
}

interface ImageGridProps {
    items: ImageResult[];
}

// Image fallback for when the external image link fails to load
const ImageFallback = ({ alt, link }: { alt: string; link: string }) => (
    <div className="flex items-center justify-center w-full h-full bg-gray-200 text-gray-500 p-2 text-center text-sm">
        <p>Image failed to load.<br />Source: {link ? (() => { try { return new URL(link).hostname } catch { return 'unknown' } })() : 'unknown'}</p>
    </div>
);

export default function ImageGrid({ items }: ImageGridProps) {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [scale, setScale] = useState(1);

    // track failed images by link so we render a React fallback instead of manipulating the DOM
    const [failedMap, setFailedMap] = useState<Record<string, boolean>>({});
    // track which links should be loaded via proxy (retry with proxy once)
    const [useProxyMap, setUseProxyMap] = useState<Record<string, boolean>>({});

    const markFailed = (link: string) => {
        setFailedMap(prev => {
            if (prev[link]) return prev;
            return { ...prev, [link]: true };
        });
        // also remove any proxy flag to avoid infinite retries
        setUseProxyMap(prev => {
            if (!prev[link]) return prev;
            const copy = { ...prev };
            delete copy[link];
            return copy;
        });
    };

    const enableProxy = (link: string) => {
        setUseProxyMap(prev => {
            if (prev[link]) return prev;
            return { ...prev, [link]: true };
        });
    };

    const openAt = (index: number) => {
        setExpandedIndex(index);
        setScale(1);
    };
    const close = () => {
        setExpandedIndex(null);
        setScale(1);
    };
    const prev = () => setExpandedIndex(i => (i === null ? null : Math.max(0, i - 1)));
    const next = () => setExpandedIndex(i => (i === null ? null : Math.min(items.length - 1, i + 1)));

    // keyboard: Esc to close, arrows for prev/next, + / - for zoom
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (expandedIndex === null) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
            if (e.key === '+' || e.key === '=') setScale(s => Math.min(3, s + 0.25));
            if (e.key === '-') setScale(s => Math.max(0.5, s - 0.25));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expandedIndex, items.length]);

    const srcFor = (item: ImageResult, preferThumbnail = true) => {
        const base = (preferThumbnail && item.thumbnail) ? item.thumbnail : item.link;
        // If proxy is enabled for this item, proxy the original/base URL
        if (useProxyMap[item.link]) {
            return `/api/image-proxy?u=${encodeURIComponent(base)}`;
        }
        return base;
    };

    return (
        <div className="p-4">
            {/* Modal overlay with full-size image + zoom controls */}
            {expandedIndex !== null && items[expandedIndex] && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    onClick={(e) => {
                        // close when clicking outside image container
                        if (e.target === e.currentTarget) close();
                    }}
                >
                    <div className="relative max-w-[95vw] max-h-[90vh] w-full bg-white rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between p-3 border-b">
                            <div className="text-sm text-gray-700 truncate" title={items[expandedIndex].title}>
                                {items[expandedIndex].title}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)))}
                                    className="px-3 py-1 bg-gray-100 rounded"
                                    aria-label="Zoom out"
                                >-</button>
                                <div className="text-sm text-gray-600 px-2">{Math.round(scale * 100)}%</div>
                                <button
                                    onClick={() => setScale(s => Math.min(3, +(s + 0.25).toFixed(2)))}
                                    className="px-3 py-1 bg-gray-100 rounded"
                                    aria-label="Zoom in"
                                >+</button>
                                <button
                                    onClick={() => setScale(1)}
                                    className="px-3 py-1 bg-gray-100 rounded"
                                    aria-label="Reset zoom"
                                >Reset</button>
                                <button onClick={prev} disabled={expandedIndex <= 0} className="px-3 py-1 bg-gray-100 rounded">Prev</button>
                                <button onClick={next} disabled={expandedIndex >= items.length - 1} className="px-3 py-1 bg-gray-100 rounded">Next</button>
                                <button onClick={close} className="px-3 py-1 bg-red-100 text-red-700 rounded">Close</button>
                            </div>
                        </div>

                        <div
                            className="w-full h-[70vh] flex items-center justify-center bg-black/5 overflow-auto"
                            onWheel={(e) => {
                                // ctrl + wheel for zoom, otherwise scroll
                                if (e.ctrlKey) {
                                    e.preventDefault();
                                    const delta = e.deltaY > 0 ? -0.1 : 0.1;
                                    setScale(s => Math.min(3, Math.max(0.5, +(s + delta).toFixed(2))));
                                }
                            }}
                        >
                            {/* render fallback if this link previously failed */}
                            {failedMap[items[expandedIndex].link] ? (
                                <ImageFallback alt={items[expandedIndex].title || 'Expanded image'} link={items[expandedIndex].link} />
                            ) : (
                                <img
                                    src={srcFor(items[expandedIndex], false)}
                                    alt={items[expandedIndex].title || 'Expanded image'}
                                    style={{ transform: `scale(${scale})`, transition: 'transform 120ms ease' }}
                                    className="max-w-full max-h-full object-contain select-none"
                                    crossOrigin="anonymous"
                                    onError={() => {
                                        // if not yet using proxy, retry via proxy once, otherwise mark failed
                                        if (!useProxyMap[items[expandedIndex].link]) {
                                            enableProxy(items[expandedIndex].link);
                                        } else {
                                            markFailed(items[expandedIndex].link);
                                        }
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Grid uses thumbnails (when available) and lazy loading for speed */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {items.map((item, index) => (
                    <div
                        key={item.link}
                        role="button"
                        tabIndex={0}
                        onClick={() => openAt(index)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openAt(index); }}
                        className="group block rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 transform hover:scale-[1.02] overflow-hidden bg-white cursor-pointer"
                    >
                        <div className="relative w-full aspect-[4/3] bg-gray-100 flex items-center justify-center">
                            {/* use thumbnail if available to speed up grid loading */}
                            {failedMap[item.link] ? (
                                <ImageFallback alt={item.title || 'Search Result Thumbnail'} link={item.link} />
                            ) : (
                                <img
                                    src={srcFor(item, true)}
                                    alt={item.title || 'Search Result Thumbnail'}
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                    crossOrigin="anonymous"
                                    onError={() => {
                                        // first retry using proxy, second time mark failed
                                        if (!useProxyMap[item.link]) {
                                            enableProxy(item.link);
                                        } else {
                                            markFailed(item.link);
                                        }
                                    }}
                                />
                            )}
                        </div>
                        <div className="p-3">
                            <p className="text-sm font-medium text-gray-800 truncate" title={item.title}>
                                {item.title}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
