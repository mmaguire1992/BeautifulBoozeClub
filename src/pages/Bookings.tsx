import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, CreditCard, CheckCircle2, Trash2 } from "lucide-react";
import { Booking } from "@/types";
import { format } from "date-fns";
import { fetchBookings, updateBooking, deleteBooking } from "@/lib/api";

export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);

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

  const updateBookingPayment = async (
    bookingId: string,
    paymentStatus: Booking["paymentStatus"],
    depositPaid?: number
  ) => {
    try {
      const updated = await updateBooking(bookingId, { paymentStatus, depositPaid });
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
    } catch {
      // ignore
    }
  };

  const handleDepositPaid = (booking: Booking) => {
    const input = prompt("Enter deposit amount received (€)", booking.depositPaid?.toString() ?? "");
    if (input === null) return;
    const amount = Number(input);
    if (Number.isNaN(amount)) return;
    updateBookingPayment(booking.id, "DepositPaid", amount);
  };

  const handlePaidInFull = (booking: Booking) => {
    updateBookingPayment(booking.id, "PaidInFull", booking.total);
  };

  const handleDelete = async (bookingId: string) => {
    if (!confirm("Remove this booking? This cannot be undone.")) return;
    try {
      await deleteBooking(bookingId);
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    } catch (err) {
      // ignore
    }
  };

  const getStatusBadge = (status: Booking['status']) => {
    const variants: Record<Booking['status'], "default" | "secondary" | "outline"> = {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calendar className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bookings</h1>
          <p className="text-muted-foreground mt-1">Manage confirmed bookings</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
        </CardHeader>
        <CardContent>
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
              {bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No bookings found
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((booking) => (
                  <TableRow
                    key={booking.id}
                    className={
                      booking.paymentStatus === "PaidInFull"
                        ? "bg-emerald-50"
                        : booking.paymentStatus === "DepositPaid"
                        ? "bg-blue-50"
                        : undefined
                    }
                  >
                    <TableCell className="font-medium">#{booking.id.slice(0, 8)}</TableCell>
                    <TableCell>{booking.customer.name}</TableCell>
                    <TableCell>{booking.event.type}</TableCell>
                    <TableCell>{booking.event.location}</TableCell>
                    <TableCell>
                      {format(new Date(booking.event.date), 'MMM dd, yyyy')} at {booking.event.time}
                    </TableCell>
                    <TableCell>{booking.event.guests}</TableCell>
                    <TableCell className="font-semibold">€{booking.total.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(booking.status)}</TableCell>
                    <TableCell>{getPaymentBadge(booking.paymentStatus)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleDepositPaid(booking)}>
                          <CreditCard className="h-4 w-4 mr-1" /> Deposit
                        </Button>
                        <Button variant="default" size="sm" onClick={() => handlePaidInFull(booking)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Paid
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(booking.id)} title="Remove booking">
                          <Trash2 className="h-4 w-4 text-destructive" />
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
