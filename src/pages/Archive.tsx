import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Search, Trash2 } from "lucide-react";
import { Booking } from "@/types";
import { format } from "date-fns";
import { fetchBookings, deleteBooking, updateBooking } from "@/lib/api";

export default function Archive() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchBookings();
        setBookings(data);
      } catch {
        // ignore for now
      }
    };
    load();
  }, []);

  const archivedBookings = useMemo(() => {
    return bookings
      .filter((booking) => booking.archived)
      .filter((booking) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
          booking.customer.name.toLowerCase().includes(term) ||
          booking.customer.email.toLowerCase().includes(term) ||
          booking.event.type.toLowerCase().includes(term) ||
          booking.event.location.toLowerCase().includes(term)
        );
      });
  }, [bookings, searchTerm]);

  const getStatusBadge = (status: Booking["status"]) => {
    const variants: Record<Booking["status"], "default" | "secondary" | "outline"> = {
      Confirmed: "default",
      Completed: "secondary",
      Cancelled: "outline",
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getPaymentBadge = (paymentStatus: Booking["paymentStatus"]) => {
    const variants: Record<Booking["paymentStatus"], { label: string; className: string }> = {
      Pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
      DepositPaid: { label: "Deposit Paid", className: "bg-blue-100 text-blue-800" },
      PaidInFull: { label: "Paid in Full", className: "bg-green-100 text-green-800" },
    };
    const variant = variants[paymentStatus];
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const handleDelete = async (bookingId: string) => {
    if (!confirm("Remove this booking? This cannot be undone.")) return;
    try {
      await deleteBooking(bookingId);
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    } catch {
      // ignore for now
    }
  };

  const handleUnarchive = async (bookingId: string) => {
    try {
      const updated = await updateBooking(bookingId, { archived: false });
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calendar className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Archived Bookings</h1>
          <p className="text-muted-foreground mt-1">Manually archived bookings live here</p>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search archived bookings..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Archived</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {archivedBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No archived bookings yet
                  </TableCell>
                </TableRow>
              ) : (
                archivedBookings.map((booking) => (
                  <TableRow key={booking.id} className="bg-muted/50">
                    <TableCell className="font-medium">#{booking.id.slice(0, 8)}</TableCell>
                    <TableCell>{booking.customer.name}</TableCell>
                    <TableCell>{booking.event.type}</TableCell>
                    <TableCell>{booking.event.location}</TableCell>
                    <TableCell>
                      {format(new Date(booking.event.date), "MMM dd, yyyy")} at {booking.event.time}
                    </TableCell>
                    <TableCell>{booking.event.guests}</TableCell>
                    <TableCell className="font-semibold">€{booking.total.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(booking.status)}</TableCell>
                    <TableCell>{getPaymentBadge(booking.paymentStatus)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(booking.id)}
                          title="Remove booking"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleUnarchive(booking.id)}>
                          Unarchive
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
