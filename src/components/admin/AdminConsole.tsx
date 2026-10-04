'use client';
// Admin console (WS8): calendar, themed weeks, film library, studio aliases. Rendered only after
// the server-side admin gate in src/app/admin/page.tsx. Every API call is gated again server side.
import { Tabs } from '@/components/ui/Tabs';
import { CalendarView, useSchedule } from './CalendarView';
import { FilmsPanel } from './FilmsPanel';
import { StudiosPanel } from './StudiosPanel';
import { ThemeForm } from './ThemeForm';

export function AdminConsole({ tomorrow }: { tomorrow: string }) {
  const schedule = useSchedule();
  return (
    <Tabs
      label="Admin tools"
      tabs={[
        { id: 'calendar', label: 'Calendar', content: <CalendarView schedule={schedule} /> },
        { id: 'themes', label: 'Themed weeks', content: <ThemeForm defaultFrom={tomorrow} onDone={() => void schedule.reload()} /> },
        { id: 'films', label: 'Film library', content: <FilmsPanel /> },
        { id: 'studios', label: 'Studios', content: <StudiosPanel /> },
      ]}
    />
  );
}
