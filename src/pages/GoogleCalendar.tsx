import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const DEFAULT_CALENDAR =
  "https://calendar.google.com/calendar/embed?height=600&wkst=2&bgcolor=%23ffffff&ctz=Europe%2FDublin&src=ZW4taWUjY3VzdG9tY2FsZW5kYXJAZ21haWwuY29t&color=%23039BE5";

export default function GoogleCalendar() {
  const calendarUrl =
    import.meta.env.VITE_GOOGLE_CALENDAR_EMBED_URL || DEFAULT_CALENDAR;
  const hasCustomCalendar = Boolean(import.meta.env.VITE_GOOGLE_CALENDAR_EMBED_URL);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Google Calendar</h1>
          <p className="text-muted-foreground mt-1">
            Keep tastings, weddings, and street events synced with your Google account.
          </p>
        </div>
      </div>

      {!hasCustomCalendar && (
        <Alert>
          <AlertTitle>Custom calendar URL</AlertTitle>
          <AlertDescription>
            Update <code>VITE_GOOGLE_CALENDAR_EMBED_URL</code> in your env file with the
            embed link from Google Calendar to display your schedule here.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Shared Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="aspect-square md:aspect-[4/3] rounded-lg border overflow-hidden bg-muted">
            <iframe
              title="Google Calendar Embed"
              src={calendarUrl}
              className="h-full w-full border-0"
              loading="lazy"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
