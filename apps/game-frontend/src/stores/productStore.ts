'use client';

import { create } from 'zustand';
import type { ProductCard } from './chatStore';

interface ProductState {
  products: ProductCard[];
  expandedProduct: ProductCard | null;
  panelOpen: boolean;
  purchaseStatus: 'idle' | 'processing' | 'success' | 'error';
  purchaseResult: string | null;

  showProducts: (agentId: string, products: ProductCard[]) => void;
  expandProduct: (product: ProductCard) => void;
  collapseProduct: () => void;
  closePanel: () => void;
  setPurchaseStatus: (status: 'processing' | 'success' | 'error', message?: string) => void;
  resetPurchase: () => void;
  clearAll: () => void;
}

export const useProductStore = create<ProductState>((set) => ({
  products: [],
  expandedProduct: null,
  panelOpen: false,
  purchaseStatus: 'idle',
  purchaseResult: null,

  showProducts: (_agentId, products) =>
    set({ products, expandedProduct: null, panelOpen: true, purchaseStatus: 'idle', purchaseResult: null }),

  expandProduct: (product) => set({ expandedProduct: product }),

  collapseProduct: () => set({ expandedProduct: null }),

  closePanel: () => set({ panelOpen: false, expandedProduct: null }),

  setPurchaseStatus: (status, message) =>
    set({ purchaseStatus: status, purchaseResult: message ?? null }),

  resetPurchase: () => set({ purchaseStatus: 'idle', purchaseResult: null }),

  clearAll: () =>
    set({ products: [], expandedProduct: null, panelOpen: false, purchaseStatus: 'idle', purchaseResult: null }),
}));
