import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;

// Instantiated client (not the deprecated global apiKey pattern).
// No pinned apiVersion: the SDK's own default always matches its typings.
export const stripe: Stripe | null = key ? new Stripe(key) : null;

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function checkoutIntegrationId(): string {
  return `arena-entry-${randomBytes(4).toString('hex')}`;
}

export function isPaidCheckout(session: Stripe.Checkout.Session): boolean {
  return session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
}
