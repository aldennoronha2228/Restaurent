import { redirect } from 'next/navigation';
export default function DashboardIndexPage({ params }: { params: { storeId: string } }) {
    redirect(`/${params.storeId}/dashboard/orders`);
}
