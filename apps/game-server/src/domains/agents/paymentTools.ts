/**
 * Shopping tools for the Shopkeeper agent.
 * Product display with server-side image enrichment.
 * Search and payment are handled by Composio tools.
 */
import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { log } from '../../logger.js';
import type { ServerMessage } from '@bossroom/shared-types';

interface PaymentToolsDeps {
  playerId: string;
  broadcastFn: (msg: ServerMessage) => void;
}

/* ------------------------------------------------------------------ */
/*  og:image scraper — fetches real product images from product pages  */
/* ------------------------------------------------------------------ */

/**
 * Fetch the og:image meta tag from a URL.
 * Reads only the first ~50KB of HTML to find it quickly.
 * Times out after 3s. Returns null on any failure.
 */
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    // Stream just enough HTML to find the og:image tag
    const reader = res.body?.getReader();
    if (!reader) return null;

    let html = '';
    const decoder = new TextDecoder();

    while (html.length < 50_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });

      // Try both attribute orderings: property then content, or content then property
      const match =
        html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ??
        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

      if (match) {
        reader.cancel().catch(() => {});
        return match[1];
      }
    }

    reader.cancel().catch(() => {});
    return null;
  } catch {
    return null;
  }
}

/**
 * Best-effort enrichment: for each product missing an imageUrl,
 * try to scrape the og:image from the product page URL.
 * All fetches run in parallel with individual timeouts.
 */
async function enrichProductImages(
  products: Array<{ name: string; url: string; imageUrl?: string; [k: string]: unknown }>,
): Promise<typeof products> {
  const results = await Promise.allSettled(
    products.map(async (p) => {
      // Already has a plausible image? Keep it — the client will handle broken ones.
      if (p.imageUrl && p.imageUrl.startsWith('http')) return p;

      const ogImage = await fetchOgImage(p.url);
      if (ogImage) {
        log.info(`[shop] Got og:image for "${p.name}": ${ogImage.slice(0, 80)}...`);
        return { ...p, imageUrl: ogImage };
      }
      return p;
    }),
  );

  return results.map((r, i) => (r.status === 'fulfilled' ? r.value : products[i]));
}

/* ------------------------------------------------------------------ */
/*  Product schema & tool                                              */
/* ------------------------------------------------------------------ */

const productSchema = z.object({
  name: z.string().describe('Product name'),
  price: z.number().describe('Price in dollars (e.g. 49.99)'),
  currency: z.string().default('USD').describe('Currency code'),
  rating: z.number().optional().describe('Star rating out of 5 (e.g. 4.3)'),
  retailer: z.string().describe('Store name (e.g. Amazon, Walmart)'),
  url: z.string().describe('Product page URL'),
  imageUrl: z.string().optional().describe('Real product image URL from search results — must be a real URL, not made up'),
  description: z.string().describe('One-line product description'),
  freeShipping: z.boolean().optional().describe('Whether the product has free shipping'),
  recommended: z.boolean().optional().describe('Mark ONE product as your top recommendation'),
});

type ProductInput = {
  name: string;
  price: number;
  currency: string;
  rating?: number;
  retailer: string;
  url: string;
  imageUrl?: string;
  description: string;
  freeShipping?: boolean;
  recommended?: boolean;
};

export function createPaymentTools(deps: PaymentToolsDeps): ToolSet {
  const { playerId, broadcastFn } = deps;

  /**
   * display_products — the Shopkeeper calls this to show product cards.
   * Before broadcasting, enriches products with real images via og:image scraping.
   */
  const displayProducts = tool({
    description: `Render product recommendations as visual cards in the chat UI. This is the ONLY way to show products — writing product info as text will produce broken output. Call this with 3-5 products. Each product must have name, price, currency, retailer, url, and description. Mark your top pick with recommended: true.`,
    inputSchema: z.object({
      products: z.array(productSchema).min(1).max(6).describe('Array of products to display as cards'),
    }),
    execute: async (args: { products: ProductInput[] }) => {
      log.info(`[shop] Displaying ${args.products.length} product cards for player ${playerId}`);

      // Enrich products with real images (best-effort, non-blocking)
      let enrichedProducts: ProductInput[];
      try {
        enrichedProducts = await enrichProductImages(args.products) as ProductInput[];
      } catch (err) {
        log.warn('[shop] Image enrichment failed, using original data:', err);
        enrichedProducts = args.products;
      }

      broadcastFn({
        type: 'agent:productCards',
        payload: {
          agentId: 'shopkeeper',
          products: enrichedProducts,
        },
      });

      const names = enrichedProducts.map((p) => p.name).join(', ');
      return `Displayed ${enrichedProducts.length} product cards to the user: ${names}. The user can now click "View" to see details or click "Buy" to purchase.`;
    },
  });

  return {
    display_products: displayProducts,
  } as ToolSet;
}
