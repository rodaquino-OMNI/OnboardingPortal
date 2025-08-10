import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  X,
  Save,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { healthRisksApi, InterventionData } from '@/lib/api/admin/health-risks';
import { format } from 'date-fns';

interface InterventionFormProps {
  alertId: string;
  onClose: () => void;
  onSubmit: () => void;
}

export default function InterventionForm({ alertId, onClose, onSubmit }: InterventionFormProps) {
  const [formData, setFormData] = useState<InterventionData>({
    action_type: 'phone_contact',
    action_description: '',
    follow_up_date: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actionTypes = [
    { value: 'phone_contact', label: 'Contato Telefônico' },
    { value: 'email_sent', label: 'Email Enviado' },
    { value: 'appointment_scheduled', label: 'Consulta Agendada' },
    { value: 'referral_made', label: 'Encaminhamento Realizado' },
    { value: 'medication_review', label: 'Revisão de Medicação' },
    { value: 'care_plan_updated', label: 'Plano de Cuidados Atualizado' },
    { value: 'educational_material_sent', label: 'Material Educativo Enviado' },
    { value: 'emergency_contact', label: 'Contato de Emergência' },
    { value: 'other', label: 'Outro' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.action_description.trim()) {
      setError('Por favor, descreva a ação realizada');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await healthRisksApi.alerts.createIntervention(alertId, formData);
      
      onSubmit();
      onClose();
    } catch (err) {
      console.error('Error creating intervention:', err);
      setError('Erro ao criar intervenção. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Nova Intervenção</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={loading}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Action Type */}
            <div>
              <Label htmlFor="action_type">Tipo de Ação *</Label>
              <select
                id="action_type"
                value={formData.action_type}
                onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {actionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Description */}
            <div>
              <Label htmlFor="action_description">Descrição da Ação *</Label>
              <Textarea
                id="action_description"
                value={formData.action_description}
                onChange={(e) => setFormData({ ...formData, action_description: e.target.value })}
                placeholder="Descreva detalhadamente a ação realizada..."
                rows={4}
                className="mt-1"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Inclua detalhes como: quem foi contatado, qual foi a resposta, próximos passos, etc.
              </p>
            </div>

            {/* Follow-up Date */}
            <div>
              <Label htmlFor="follow_up_date">Data de Acompanhamento</Label>
              <div className="relative mt-1">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="datetime-local"
                  id="follow_up_date"
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                  min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Opcional: Defina uma data para acompanhamento desta intervenção
              </p>
            </div>

            {/* Additional Notes */}
            <div>
              <Label htmlFor="notes">Observações Adicionais</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Informações adicionais relevantes..."
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Salvando...' : 'Salvar Intervenção'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}