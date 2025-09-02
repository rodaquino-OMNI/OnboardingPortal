'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface InterventionFormProps {
  alertId: string;
  onSubmit: (intervention: InterventionData) => Promise<void>;
  onCancel: () => void;
}

interface InterventionData {
  type: string;
  priority: string;
  description: string;
  assignedTo?: string;
  dueDate?: string;
}

export default function InterventionForm({ alertId, onSubmit, onCancel }: InterventionFormProps) {
  const [formData, setFormData] = useState<InterventionData>({
    type: '',
    priority: 'medium',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type || !formData.description) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Health Intervention</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Intervention Type
            </label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select intervention type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consultation">Medical Consultation</SelectItem>
                <SelectItem value="screening">Health Screening</SelectItem>
                <SelectItem value="lifestyle">Lifestyle Counseling</SelectItem>
                <SelectItem value="medication">Medication Review</SelectItem>
                <SelectItem value="referral">Specialist Referral</SelectItem>
                <SelectItem value="monitoring">Ongoing Monitoring</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Priority Level
            </label>
            <Select 
              value={formData.priority} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low Priority</SelectItem>
                <SelectItem value="medium">Medium Priority</SelectItem>
                <SelectItem value="high">High Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Intervention Description
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the recommended intervention, including specific steps, timeline, and expected outcomes..."
              rows={4}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Assigned Healthcare Provider (Optional)
            </label>
            <Select 
              value={formData.assignedTo || ''} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, assignedTo: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select healthcare provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dr-silva">Dr. Maria Silva</SelectItem>
                <SelectItem value="dr-santos">Dr. João Santos</SelectItem>
                <SelectItem value="dr-oliveira">Dr. Ana Oliveira</SelectItem>
                <SelectItem value="nurse-coord">Nursing Coordinator</SelectItem>
                <SelectItem value="health-team">General Health Team</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Target Completion Date (Optional)
            </label>
            <input
              type="date"
              value={formData.dueDate || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.type || !formData.description}
            >
              {isSubmitting ? 'Creating...' : 'Create Intervention'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
