import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createEnquiry } from "@/lib/api";
import { Enquiry } from "@/types";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function NewEnquiry() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    service: "" as Enquiry['service'] | "",
    eventType: "",
    location: "",
    preferredDate: "",
    preferredTime: "",
    guests: "",
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.service) newErrors.service = "Service is required";
    if (!formData.eventType.trim()) newErrors.eventType = "Event type is required";
    if (!formData.location.trim()) newErrors.location = "Location is required";
    if (!formData.preferredDate) newErrors.preferredDate = "Preferred date is required";
    if (!formData.preferredTime) newErrors.preferredTime = "Preferred time is required";
    if (!formData.guests || parseInt(formData.guests) <= 0) {
      newErrors.guests = "Number of guests must be positive";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (createQuote = false) => {
    if (!validate()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    setSubmitting(true);
    try {
      const enquiry: Enquiry = await createEnquiry({
        name: formData.name,
        email: formData.email,
        service: formData.service as Enquiry["service"],
        eventType: formData.eventType,
        location: formData.location,
        preferredDate: formData.preferredDate,
        preferredTime: formData.preferredTime,
        guests: parseInt(formData.guests),
        notes: formData.notes || undefined,
      });

      toast.success("Enquiry saved successfully");

      if (createQuote) {
        navigate(`/quotes/new?enquiryId=${enquiry.id}`);
      } else {
        navigate("/enquiries");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to save enquiry");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/enquiries")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">New Enquiry</h1>
          <p className="text-muted-foreground mt-1">Enter customer enquiry details</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Your Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service">Which of our services are you enquiring about? *</Label>
            <Select 
              value={formData.service} 
              onValueChange={(value) => setFormData({ ...formData, service: value as Enquiry['service'] })}
            >
              <SelectTrigger className={errors.service ? "border-destructive" : ""}>
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mobile Bar Hire">Mobile Bar Hire</SelectItem>
                <SelectItem value="Cocktail Class">Cocktail Class</SelectItem>
                <SelectItem value="Boozy Brunch">Boozy Brunch</SelectItem>
                <SelectItem value="Equipment Hire">Equipment Hire</SelectItem>
              </SelectContent>
            </Select>
            {errors.service && <p className="text-xs text-destructive">{errors.service}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="eventType">What Type of Event Do You Need Us For? *</Label>
            <Input
              id="eventType"
              placeholder="e.g., Hen Party, Corporate Event"
              value={formData.eventType}
              onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
              className={errors.eventType ? "border-destructive" : ""}
            />
            {errors.eventType && <p className="text-xs text-destructive">{errors.eventType}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Where will your event take place? *</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className={errors.location ? "border-destructive" : ""}
            />
            {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="preferredDate">Preferred Date *</Label>
              <Input
                id="preferredDate"
                type="date"
                value={formData.preferredDate}
                onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                className={errors.preferredDate ? "border-destructive" : ""}
              />
              {errors.preferredDate && <p className="text-xs text-destructive">{errors.preferredDate}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredTime">Preferred Time *</Label>
              <Input
                id="preferredTime"
                type="time"
                value={formData.preferredTime}
                onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                className={errors.preferredTime ? "border-destructive" : ""}
              />
              {errors.preferredTime && <p className="text-xs text-destructive">{errors.preferredTime}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="guests">Number of Guests? *</Label>
              <Input
                id="guests"
                type="number"
                min="1"
                value={formData.guests}
                onChange={(e) => setFormData({ ...formData, guests: e.target.value })}
                className={errors.guests ? "border-destructive" : ""}
              />
              {errors.guests && <p className="text-xs text-destructive">{errors.guests}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Information</Label>
            <Textarea
              id="notes"
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={() => handleSubmit(false)} disabled={submitting}>
              Save Enquiry
            </Button>
            <Button variant="outline" onClick={() => handleSubmit(true)} disabled={submitting}>
              Save & Create Quote
            </Button>
            <Button variant="ghost" onClick={() => navigate("/enquiries")}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
