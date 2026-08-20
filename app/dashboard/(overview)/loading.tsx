import DashboardSkeleton from '@/app/ui/skeletons'

export default function Loading() {
    return <DashboardSkeleton />;
}

//instant loading for whole page (not single component, side effect: request waterfaall)
//currently: not active because i use stream every component individually in app/dashboard/(overview)/page.tsx