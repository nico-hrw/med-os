import { SimEvent } from '../types/simulation-types';

/**
 * Vektorisierter binaerer Min-Heap zur ereignisdiskreten Simulation.
 * Bietet O(log N) fuer Einfuege- und Entnahme-Operationen.
 * Ersetzt den Python SimPy-Overhead durch native High-Performance-Ablaeufe.
 */
export class EventHeap {
  private heap: SimEvent[] = [];

  public push(event: SimEvent): void {
    this.heap.push(event);
    this.siftUp(this.heap.length - 1);
  }

  public pop(): SimEvent | undefined {
    if (this.heap.length === 0) return undefined;
    const root = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return root;
  }

  public peek(): SimEvent | undefined {
    return this.heap[0];
  }

  public size(): number {
    return this.heap.length;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  public clear(): void {
    this.heap = [];
  }

  private compare(a: SimEvent, b: SimEvent): number {
    if (a.timeMins !== b.timeMins) {
      return a.timeMins - b.timeMins;
    }
    return a.priority - b.priority;
  }

  private siftUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.compare(this.heap[current], this.heap[parent]) < 0) {
        this.swap(current, parent);
        current = parent;
      } else {
        break;
      }
    }
  }

  private siftDown(index: number): void {
    let current = index;
    const length = this.heap.length;

    while (true) {
      let smallest = current;
      const left = 2 * current + 1;
      const right = 2 * current + 2;

      if (left < length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest !== current) {
        this.swap(current, smallest);
        current = smallest;
      } else {
        break;
      }
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
  }
}
