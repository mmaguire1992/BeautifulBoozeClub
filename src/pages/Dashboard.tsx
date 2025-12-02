import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Mail, FileText, CheckCircle, Calendar, ArrowRight, PiggyBank, Search } from "lucide-react";
import { Enquiry, Quote, Booking } from "@/types";
import { format, isToday, isTomorrow } from "date-fns";
import { fetchEnquiries, fetchQuotes, fetchBookings } from "@/lib/api";

export default function Dashboard() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(value);

  const newEnquiries = enquiries.filter(e => e.status === 'New').length;
  const awaitingAction = quotes.filter(q => q.status === 'Draft' || q.status === 'Sent').length;
  const acceptedQuotes = quotes.filter(q => q.status === 'Accepted').length;
  const upcomingBookings = bookings.filter(b => {
    const bookingDate = new Date(b.event.date);
    return isToday(bookingDate) || isTomorrow(bookingDate);
  });
  const outstandingDeposits = bookings.reduce((sum, booking) => {
    if (booking.paymentStatus === "PaidInFull") return sum;
    const paid = booking.depositPaid ?? 0;
    const remaining = Math.max(booking.total - paid, 0);
    return sum + remaining;
  }, 0);

  const searchResults =
    searchTerm.trim() === ""
      ? []
      : (() => {
          const term = searchTerm.toLowerCase();
          const includes = (value?: string) => value?.toLowerCase().includes(term);
          const results: {
            id: string;
            type: "Enquiry" | "Quote" | "Booking";
            title: string;
            subtitle: string;
            link: string;
          }[] = [];

          enquiries.forEach((enquiry) => {
            if (includes(enquiry.name) || includes(enquiry.email) || includes(enquiry.location) || includes(enquiry.eventType)) {
              results.push({
                id: enquiry.id,
                type: "Enquiry",
                title: enquiry.name,
                subtitle: `${enquiry.eventType} • ${format(new Date(enquiry.preferredDate), "MMM dd")} @ ${enquiry.location}`,
                link: "/enquiries",
              });
            }
          });

          quotes.forEach((quote) => {
            if (
              includes(quote.customer.name) ||
              includes(quote.customer.email) ||
              includes(quote.event.location) ||
              includes(quote.event.type)
            ) {
              results.push({
                id: quote.id,
                type: "Quote",
                title: quote.customer.name,
                subtitle: `${quote.event.type} • ${format(new Date(quote.event.date), "MMM dd")} @ ${quote.event.location}`,
                link: `/quotes/${quote.id}`,
              });
            }
          });

          bookings.forEach((booking) => {
            if (
              includes(booking.customer.name) ||
              includes(booking.customer.email) ||
              includes(booking.event.location) ||
              includes(booking.event.type)
            ) {
              results.push({
                id: booking.id,
                type: "Booking",
                title: booking.customer.name,
                subtitle: `${booking.event.type} • ${format(new Date(booking.event.date), "MMM dd")} @ ${booking.event.location}`,
                link: "/bookings",
              });
            }
          });

          return results.slice(0, 8);
        })();

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome to your operations center</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Deposits</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(outstandingDeposits)}</div>
            <p className="text-xs text-muted-foreground mt-2">Due before event dates</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quick Search</CardTitle>
            <p className="text-sm text-muted-foreground">Find enquiries, quotes, or bookings fast</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, event type, or location"
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {searchTerm.trim() === "" ? (
              <p className="text-sm text-muted-foreground">Start typing to jump to a record.</p>
            ) : searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches found.</p>
            ) : (
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <Link
                    key={`${result.type}-${result.id}`}
                    to={result.link}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{result.title}</p>
                      <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                    </div>
                    <Badge variant="secondary">{result.type}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
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
  );
}
