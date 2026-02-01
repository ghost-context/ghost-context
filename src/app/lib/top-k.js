// src/app/lib/top-k.js

/**
 * TopK maintains only the top K items using a min-heap.
 * Memory: O(k) instead of O(n) for large datasets.
 *
 * Usage:
 *   const topK = new TopK(100, (a, b) => a.count - b.count);
 *   for (const item of items) topK.push(item);
 *   const results = topK.getResults(); // sorted descending
 */
export class TopK {
  constructor(k, compareFn) {
    this.k = k;
    this.heap = [];
    this.compare = compareFn || ((a, b) => a - b);
  }

  push(item) {
    if (this.heap.length < this.k) {
      this.heap.push(item);
      this._bubbleUp(this.heap.length - 1);
    } else if (this.compare(item, this.heap[0]) > 0) {
      // New item is larger than smallest in heap - replace
      this.heap[0] = item;
      this._bubbleDown(0);
    }
    // Otherwise item is too small - discard
  }

  getResults() {
    // Return sorted descending (largest first)
    return [...this.heap].sort((a, b) => this.compare(b, a));
  }

  get size() {
    return this.heap.length;
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parent]) >= 0) break;
      [this.heap[index], this.heap[parent]] = [this.heap[parent], this.heap[index]];
      index = parent;
    }
  }

  _bubbleDown(index) {
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;

      if (left < this.heap.length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < this.heap.length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}
