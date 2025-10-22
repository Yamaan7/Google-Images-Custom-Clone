'use client';

import { useEffect, useState } from 'react';

interface ImageResult {
    title: string;
    link: string;
    thumbnail?: string;
}

interface ImageGridProps {
    items: ImageResult[];
}

export default function ImageGrid({ items }: ImageGridProps) {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [scale, setScale] = useState(1);

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
            if (e.key === '+' || e.key === '=') setScale(s => Math.min(5, s + 0.25));
            if (e.key === '-') setScale(s => Math.max(0.2, s - 0.25));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [expandedIndex, items.length]);

    return (
        <div className="p-4">
            {/* Modal overlay with full-size image + zoom controls */}
            {expandedIndex !== null && items[expandedIndex] && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                    onClick={(e) => {
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
                                    onClick={() => setScale(s => Math.max(0.2, +(s - 0.25).toFixed(2)))}
                                    className="px-3 py-1 bg-gray-100 rounded"
                                >-</button>
                                <div className="text-sm text-gray-600 px-2">{Math.round(scale * 100)}%</div>
                                <button
                                    onClick={() => setScale(s => Math.min(5, +(s + 0.25).toFixed(2)))}
                                    className="px-3 py-1 bg-gray-100 rounded"
                                >+</button>
                                <button onClick={() => setScale(1)} className="px-3 py-1 bg-gray-100 rounded">Reset</button>
                                <button onClick={prev} disabled={expandedIndex <= 0} className="px-3 py-1 bg-gray-100 rounded">Prev</button>
                                <button onClick={next} disabled={expandedIndex >= items.length - 1} className="px-3 py-1 bg-gray-100 rounded">Next</button>
                                <button onClick={close} className="px-3 py-1 bg-red-100 text-red-700 rounded">Close</button>
                            </div>
                        </div>

                        <div
                            className="w-full h-[70vh] flex items-center justify-center bg-black/10 overflow-auto"
                            onWheel={(e) => {
                                if (e.ctrlKey) {
                                    e.preventDefault();
                                    const delta = e.deltaY > 0 ? -0.1 : 0.1;
                                    setScale(s => Math.min(5, Math.max(0.2, +(s + delta).toFixed(2))));
                                }
                            }}
                        >
                            <img
                                src={items[expandedIndex].link}
                                alt={items[expandedIndex].title || 'Expanded image'}
                                style={{ transform: `scale(${scale})`, transition: 'transform 120ms ease' }}
                                className="max-w-full max-h-full object-contain select-none"
                                crossOrigin="anonymous"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Image grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {items.map((item, index) => (
                    <div
                        key={item.link}
                        role="button"
                        tabIndex={0}
                        onClick={() => openAt(index)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openAt(index); }}
                        className="group block rounded-xl shadow-lg hover:shadow-2xl transition-transform duration-300 hover:scale-[1.03] overflow-hidden bg-white cursor-pointer"
                    >
                        <div className="relative w-full aspect-[4/3] bg-gray-100 flex items-center justify-center">
                            <img
                                src={item.thumbnail || item.link}
                                alt={item.title || 'Search Result Thumbnail'}
                                loading="lazy"
                                className="w-full h-full object-cover"
                                crossOrigin="anonymous"
                            />
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
