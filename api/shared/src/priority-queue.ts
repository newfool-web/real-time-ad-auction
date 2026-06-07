// Binary MaxHeap — auction engine isse bids ko rank karta hai.
// pop() -> highest bid (winner), uske baad peek()/pop() -> second highest (price).
// Note: chote N pe linear scan bhi chalega, par heap ordered extraction
// clean deta hai aur multi-slot top-K ke liye scale karta hai.
export class MaxHeap<T> {
  private data: T[] = [];
  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.data.length;
  }

  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  peek(): T | undefined {
    return this.data[0];
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.data[i], this.data[parent]) <= 0) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  private bubbleDown(i: number): void {
    const n = this.data.length;
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let largest = i;
      if (left < n && this.compare(this.data[left], this.data[largest]) > 0) largest = left;
      if (right < n && this.compare(this.data[right], this.data[largest]) > 0) largest = right;
      if (largest === i) break;
      this.swap(i, largest);
      i = largest;
    }
  }

  private swap(a: number, b: number): void {
    [this.data[a], this.data[b]] = [this.data[b], this.data[a]];
  }
}
