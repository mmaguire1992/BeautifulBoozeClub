import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, FileText, CheckCircle, Calendar, ArrowRight } from "lucide-react";
import { Enquiry, Quote, Booking } from "@/types";
import { format, isToday, isTomorrow } from "date-fns";
import { fetchEnquiries, fetchQuotes, fetchBookings } from "@/lib/api";

export default function Dashboard() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [enq, quo, book] = await Promise.all([fetchEnquiries(), fetchQuotes(), fetchBookings()]);
        setEnquiries(enq);
        setQuotes(quo);
        setBookings(book);
      } catch {
        // ignore for dashboard
      }
    };
    load();
  }, []);

  const newEnquiries = enquiries.filter(e => e.status === 'New').length;
  const awaitingAction = quotes.filter(q => q.status === 'Draft' || q.status === 'Sent').length;
  const acceptedQuotes = quotes.filter(q => q.status === 'Accepted').length;
  const upcomingBookings = bookings.filter(b => {
    const bookingDate = new Date(b.event.date);
    return isToday(bookingDate) || isTomorrow(bookingDate);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome to your operations center</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New Enquiries</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newEnquiries}</div>
            <Link to="/enquiries" className="text-xs text-accent hover:underline flex items-center gap-1 mt-2">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Quotes Pending</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{awaitingAction}</div>
            <Link to="/quotes" className="text-xs text-accent hover:underline flex items-center gap-1 mt-2">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Accepted Quotes</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{acceptedQuotes}</div>
            <p className="text-xs text-muted-foreground mt-2">Ready to convert</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingBookings.length}</div>
            <Link to="/bookings" className="text-xs text-accent hover:underline flex items-center gap-1 mt-2">
              View calendar <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today & Tomorrow</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming events</p>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map(booking => {
                  const bookingDate = new Date(booking.event.date);
                  return (
                    <div key={booking.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium text-sm">{booking.event.type}</p>
                        <p className="text-xs text-muted-foreground">{booking.event.location}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(bookingDate, 'MMM dd')} at {booking.event.time}
                        </p>
                      </div>
                      <Badge variant={booking.status === 'Confirmed' ? 'default' : 'secondary'}>
                        {booking.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/enquiries/new">
              <Button className="w-full justify-start" variant="outline">
                <Mail className="mr-2 h-4 w-4" />
                Add New Enquiry
              </Button>
            </Link>
            <Link to="/quotes/new">
              <Button className="w-full justify-start" variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Create New Quote
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
