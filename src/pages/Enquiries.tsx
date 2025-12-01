import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Eye, FileText, Trash2 } from "lucide-react";
import { Enquiry } from "@/types";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchEnquiries, deleteEnquiry } from "@/lib/api";

export default function Enquiries() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const data = await fetchEnquiries();
        setEnquiries(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load enquiries");
        toast.error(err?.message || "Failed to load enquiries");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredEnquiries = enquiries.filter((e) =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.eventType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: Enquiry['status']) => {
    const variants: Record<Enquiry['status'], "default" | "secondary" | "outline"> = {
      New: "default",
      Quoted: "secondary",
      Closed: "outline",
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Enquiries</h1>
          <p className="text-muted-foreground mt-1">Manage customer enquiries</p>
        </div>
        <Link to="/enquiries/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Enquiry
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Enquiries</CardTitle>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search enquiries..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Event Date</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Loading enquiries...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              ) : filteredEnquiries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No enquiries found
                  </TableCell>
                </TableRow>
              ) : (
                filteredEnquiries.map((enquiry) => (
                  <TableRow key={enquiry.id}>
                    <TableCell>{format(new Date(enquiry.createdAt), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="font-medium">{enquiry.name}</TableCell>
                    <TableCell>{enquiry.service}</TableCell>
                    <TableCell>{enquiry.eventType}</TableCell>
                    <TableCell>{format(new Date(enquiry.preferredDate), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{enquiry.guests}</TableCell>
                    <TableCell>{getStatusBadge(enquiry.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Link to={`/quotes/new?enquiryId=${enquiry.id}`}>
                          <Button variant="ghost" size="icon">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (!confirm("Delete this enquiry? This cannot be undone.")) return;
                            try {
                              await deleteEnquiry(enquiry.id);
                              setEnquiries((prev) => prev.filter((e) => e.id !== enquiry.id));
                              toast.success("Enquiry deleted");
                            } catch (err: any) {
                              toast.error(err?.message || "Failed to delete enquiry");
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
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
