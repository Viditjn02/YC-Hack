/** Floating product canvas overlay — shows product cards from the Shopkeeper agent. */
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useProductStore } from '@/stores/productStore';
import { useChatStore, type ProductCard } from '@/stores/chatStore';

/* ------------------------------------------------------------------ */
/*  Product Image with multi-stage fallback                            */
/* ------------------------------------------------------------------ */

/** Extract the bare domain from a URL string. */
function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Product image with 3-stage fallback:
 * 1. Original image URL (from og:image enrichment or Composio search)
 * 2. Google Favicon API — shows the retailer's logo (always works, no key)
 * 3. Styled placeholder with emoji
 */
function ProductImage({
  src,
  alt,
  productUrl,
  className,
}: {
  src?: string;
  alt: string;
  productUrl?: string;
  className: string;
}) {
  const [stage, setStage] = useState<'image' | 'favicon' | 'placeholder'>(
    src ? 'image' : 'favicon',
  );

  const faviconUrl = useMemo(() => {
    if (!productUrl) return null;
    const domain = extractDomain(productUrl);
    if (!domain) return null;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  }, [productUrl]);

  // Reset stage when src changes (new products loaded)
  useEffect(() => {
    setStage(src ? 'image' : 'favicon');
  }, [src]);

  // Stage 3: Emoji placeholder
  if (stage === 'placeholder' || (stage === 'favicon' && !faviconUrl)) {
    return (
      <div className={`${className} bg-white/5 flex items-center justify-center`}>
        <span className="text-white/20 text-2xl">🛍️</span>
      </div>
    );
  }

  // Stage 2: Google Favicon (retailer logo)
  if (stage === 'favicon' && faviconUrl) {
    return (
      <div className={`${className} bg-white/5 flex items-center justify-center`}>
        <img
          src={faviconUrl}
          alt={alt}
          className="w-12 h-12 object-contain opacity-60"
          onError={() => setStage('placeholder')}
        />
      </div>
    );
  }

  // Stage 1: Real product image
  return (
    <img
      src={src}
      alt={alt}
      className={`${className} object-cover bg-white/5`}
      onError={() => setStage(faviconUrl ? 'favicon' : 'placeholder')}
    />
  );
}

function GridCard({
  product,
  onView,
  onBuy,
}: {
  product: ProductCard;
  onView: () => void;
  onBuy: () => void;
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 transition-all hover:scale-[1.02] cursor-default ${
        product.recommended
          ? 'border-purple-500/50 bg-purple-500/10 shadow-lg shadow-purple-500/10'
          : 'border-white/10 bg-white/5'
      }`}
    >
      {product.recommended && (
        <span className="inline-block text-[10px] font-bold tracking-wider text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full mb-2 uppercase">
          Top Pick
        </span>
      )}

      <ProductImage
        src={product.imageUrl}
        alt={product.name}
        productUrl={product.url}
        className="w-full h-28 rounded-lg mb-2"
      />

      <h4 className="text-white text-sm font-medium leading-snug line-clamp-2">
        {product.name}
      </h4>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-white font-bold text-base">
          ${product.price.toFixed(2)}
        </span>
        {product.rating !== undefined && (
          <span className="text-amber-400 text-xs">
            {'★'} {product.rating.toFixed(1)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-white/40">
        <span>{product.retailer}</span>
        {product.freeShipping && (
          <>
            <span className="text-white/15">·</span>
            <span className="text-green-400/80">Free shipping</span>
          </>
        )}
      </div>

      <p className="text-white/30 text-[11px] mt-1.5 leading-relaxed line-clamp-2">
        {product.description}
      </p>

      <div className="flex gap-2 mt-3">
        <button
          onClick={onView}
          className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium
            bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
        >
          Details
        </button>
        <button
          onClick={onBuy}
          className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium
            bg-purple-600 hover:bg-purple-500 text-white transition-colors"
        >
          Buy
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail View                                                        */
/* ------------------------------------------------------------------ */

function DetailView({
  product,
  onBack,
  onBuy,
}: {
  product: ProductCard;
  onBack: () => void;
  onBuy: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Back link */}
      <button
        onClick={onBack}
        className="self-start text-xs text-purple-400 hover:text-purple-300 mb-3 flex items-center gap-1 transition-colors"
      >
        <span>←</span> Back to results
      </button>

      {/* Product image */}
      <ProductImage
        src={product.imageUrl}
        alt={product.name}
        productUrl={product.url}
        className="w-full h-48 rounded-xl mb-4"
      />

      {/* Info */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {product.recommended && (
          <span className="inline-block text-[10px] font-bold tracking-wider text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full uppercase">
            Top Pick
          </span>
        )}

        <h3 className="text-white text-lg font-semibold leading-snug">
          {product.name}
        </h3>

        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-2xl">
            ${product.price.toFixed(2)}
          </span>
          <span className="text-white/30 text-sm">{product.currency}</span>
        </div>

        <div className="flex items-center gap-3 text-sm text-white/50">
          <span>{product.retailer}</span>
          {product.rating !== undefined && (
            <>
              <span className="text-white/15">·</span>
              <span className="text-amber-400">{'★'} {product.rating.toFixed(1)}</span>
            </>
          )}
          {product.freeShipping && (
            <>
              <span className="text-white/15">·</span>
              <span className="text-green-400">Free shipping</span>
            </>
          )}
        </div>

        <p className="text-white/50 text-sm leading-relaxed">
          {product.description}
        </p>

        {/* Visit site link */}
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          Visit site
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M6.22 8.72a.75.75 0 0 0 1.06 1.06l5.22-5.22v1.69a.75.75 0 0 0 1.5 0v-3.5a.75.75 0 0 0-.75-.75h-3.5a.75.75 0 0 0 0 1.5h1.69L6.22 8.72Z" />
            <path d="M3.5 6.75c0-.69.56-1.25 1.25-1.25H7A.75.75 0 0 0 7 4H4.75A2.75 2.75 0 0 0 2 6.75v4.5A2.75 2.75 0 0 0 4.75 14h4.5A2.75 2.75 0 0 0 12 11.25V9a.75.75 0 0 0-1.5 0v2.25c0 .69-.56 1.25-1.25 1.25h-4.5c-.69 0-1.25-.56-1.25-1.25v-4.5Z" />
          </svg>
        </a>
      </div>

      {/* Buy button */}
      <button
        onClick={onBuy}
        className="mt-4 w-full py-3 rounded-xl text-sm font-semibold
          bg-purple-600 hover:bg-purple-500 text-white transition-colors"
      >
        Buy for ${product.price.toFixed(2)}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Purchase Overlay                                                   */
/* ------------------------------------------------------------------ */

function PurchaseOverlay() {
  const status = useProductStore((s) => s.purchaseStatus);
  const result = useProductStore((s) => s.purchaseResult);
  const resetPurchase = useProductStore((s) => s.resetPurchase);

  if (status === 'idle') return null;

  return (
    <div className="absolute inset-0 z-10 bg-gray-950/90 rounded-xl flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        {status === 'processing' && (
          <>
            <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-white/70 text-sm">Processing purchase...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <span className="text-green-400 text-2xl">✓</span>
            </div>
            <p className="text-white text-sm font-medium">Purchase complete!</p>
            <p className="text-white/50 text-xs">{result}</p>
            <button
              onClick={resetPurchase}
              className="mt-2 px-4 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
            >
              Done
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
              <span className="text-red-400 text-2xl">✕</span>
            </div>
            <p className="text-white text-sm font-medium">Purchase failed</p>
            <p className="text-white/50 text-xs">{result}</p>
            <button
              onClick={resetPurchase}
              className="mt-2 px-4 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
            >
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Canvas                                                        */
/* ------------------------------------------------------------------ */

export function ProductCanvas() {
  const products = useProductStore((s) => s.products);
  const expandedProduct = useProductStore((s) => s.expandedProduct);
  const panelOpen = useProductStore((s) => s.panelOpen);
  const expandProduct = useProductStore((s) => s.expandProduct);
  const collapseProduct = useProductStore((s) => s.collapseProduct);
  const closePanel = useProductStore((s) => s.closePanel);

  const activeAgent = useChatStore((s) => s.activeAgent);

  // Auto-close when user leaves shopkeeper
  useEffect(() => {
    if (activeAgent !== 'shopkeeper' && panelOpen) {
      closePanel();
    }
  }, [activeAgent, panelOpen, closePanel]);

  function handleBuy(product: ProductCard) {
    // Send as a chat message — the LLM will call process_payment immediately
    // The [PURCHASE CONFIRMED] prefix tells the LLM this is a confirmed buy, no re-asking
    const buyMessage = `[PURCHASE CONFIRMED] Buy ${product.name} for $${product.price.toFixed(2)} from ${product.retailer}. Product URL: ${product.url}`;
    useChatStore.getState().sendMessage('shopkeeper', buyMessage);
    // Close the product canvas — result will show in chat
    closePanel();
  }

  if (!panelOpen || products.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center p-4"
      onClick={closePanel}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-2xl max-h-[80vh] bg-gray-950/95 backdrop-blur-md
          rounded-2xl border border-purple-500/20 shadow-2xl shadow-purple-500/10
          flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-purple-400 text-sm">🛍️</span>
            <h3 className="text-white font-semibold text-sm">
              {expandedProduct ? expandedProduct.name : `${products.length} Products`}
            </h3>
          </div>
          <button
            onClick={closePanel}
            className="text-white/40 hover:text-white text-lg leading-none p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 relative">
          <PurchaseOverlay />

          {expandedProduct ? (
            <DetailView
              product={expandedProduct}
              onBack={collapseProduct}
              onBuy={() => handleBuy(expandedProduct)}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((product, i) => (
                <GridCard
                  key={`${product.url}-${i}`}
                  product={product}
                  onView={() => expandProduct(product)}
                  onBuy={() => handleBuy(product)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
