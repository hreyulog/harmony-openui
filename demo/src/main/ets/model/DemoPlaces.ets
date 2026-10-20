// SPDX-License-Identifier: Apache-2.0
export interface Place { id: string; title: string; kind: string; duration: string; detail: string; image: string; }
// Host facts are intentionally fictional. Photos illustrate activity categories,
// not these fictional venues. The model creates UI, not a search result dataset.
export const PLACES: Place[] = [
  { id: 'lake-walk', title: '湖畔慢走', kind: 'park', duration: 'short', detail: '户外 · 约 1 小时 · 适合轻松散步',
    image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=800&q=75&fit=crop' },
  { id: 'city-museum', title: '城市展馆', kind: 'museum', duration: 'long', detail: '室内 · 约 2 小时 · 看一场主题展览',
    image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=75&fit=crop' },
  { id: 'corner-books', title: '街角书店', kind: 'bookstore', duration: 'short', detail: '室内 · 约 1 小时 · 阅读与休息',
    image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=75&fit=crop' },
  { id: 'forest-trail', title: '林间步道', kind: 'park', duration: 'long', detail: '户外 · 约 2 小时 · 适合步行探索',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=75&fit=crop' }
];
