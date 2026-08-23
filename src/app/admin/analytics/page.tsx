import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getAdminAnalytics } from '@/lib/admin-queries';
import { Container, Label } from '@/components/ui';
import { formatMoney } from '@/lib/format';

export const metadata: Metadata = { title: 'Admin Analytics' };

export default async function AdminAnalyticsPage() {
  await requireAdmin('/admin/analytics');
  const metrics = await getAdminAnalytics();
  const cells = [
    { label: 'Arena fill rate', value: `${metrics.fillRate}%` },
    { label: 'Checkout conversion', value: `${metrics.checkoutConversion}%` },
    { label: 'Revenue per Arena', value: formatMoney(metrics.revenuePerArena) },
    { label: 'Share rate', value: `${metrics.shareRate}%` },
    { label: 'Repeat entry rate', value: `${metrics.repeatEntryRate}%` },
  ];
  return (
    <Container className="py-12">
      <Label>Analytics</Label>
      <h1 className="mt-3 text-4xl font-semibold tracking-headline">Business pulse</h1>
      <div className="mt-10 grid grid-cols-2 border hairline md:grid-cols-5">
        {cells.map((cell) => (
          <div key={cell.label} className="border-r hairline px-5 py-6">
            <Label>{cell.label}</Label>
            <p className="num mt-3 text-2xl">{cell.value}</p>
          </div>
        ))}
      </div>
    </Container>
  );
}
