'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Search, 
  Plus, 
  X, 
  Pill, 
  AlertTriangle,
  ChevronDown,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MedicationOption {
  id: string;
  name: string;
  genericName?: string;
  category: string;
  commonDosages: string[];
  warnings?: string[];
  emoji: string;
}

interface SelectedMedication {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  category: string;
  emoji: string;
}

interface MedicationSelectorProps {
  onComplete: (medications: SelectedMedication[]) => void;
  isProcessing?: boolean;
  initialValue?: SelectedMedication[];
}

// Common medications database (expandable)
const COMMON_MEDICATIONS: MedicationOption[] = [
  // Cardiovascular
  { id: 'atenolol', name: 'Atenolol', category: 'Cardiovascular', commonDosages: ['25mg', '50mg', '100mg'], emoji: '❤️' },
  { id: 'losartan', name: 'Losartan', category: 'Cardiovascular', commonDosages: ['25mg', '50mg', '100mg'], emoji: '❤️' },
  { id: 'amlodipine', name: 'Amlodipina', category: 'Cardiovascular', commonDosages: ['2.5mg', '5mg', '10mg'], emoji: '❤️' },
  { id: 'hydrochlorothiazide', name: 'Hidroclorotiazida', category: 'Cardiovascular', commonDosages: ['12.5mg', '25mg'], emoji: '❤️' },
  
  // Diabetes
  { id: 'metformin', name: 'Metformina', category: 'Diabetes', commonDosages: ['500mg', '850mg', '1000mg'], emoji: '🩸' },
  { id: 'glibenclamide', name: 'Glibenclamida', category: 'Diabetes', commonDosages: ['2.5mg', '5mg'], emoji: '🩸' },
  { id: 'insulin', name: 'Insulina', category: 'Diabetes', commonDosages: ['Variável'], emoji: '💉' },
  
  // Mental Health
  { id: 'sertraline', name: 'Sertralina', category: 'Saúde Mental', commonDosages: ['25mg', '50mg', '100mg'], emoji: '🧠' },
  { id: 'fluoxetine', name: 'Fluoxetina', category: 'Saúde Mental', commonDosages: ['20mg', '40mg'], emoji: '🧠' },
  { id: 'clonazepam', name: 'Clonazepam', category: 'Saúde Mental', commonDosages: ['0.5mg', '1mg', '2mg'], warnings: ['Pode causar dependência'], emoji: '🧠' },
  
  // Pain/Anti-inflammatory
  { id: 'ibuprofen', name: 'Ibuprofeno', category: 'Anti-inflamatório', commonDosages: ['200mg', '400mg', '600mg'], emoji: '💊' },
  { id: 'paracetamol', name: 'Paracetamol', category: 'Anti-inflamatório', commonDosages: ['500mg', '750mg'], emoji: '💊' },
  { id: 'diclofenac', name: 'Diclofenaco', category: 'Anti-inflamatório', commonDosages: ['50mg', '75mg'], emoji: '💊' },
  
  // Respiratory
  { id: 'salbutamol', name: 'Salbutamol', category: 'Respiratório', commonDosages: ['100mcg/dose', '200mcg/dose'], emoji: '🫁' },
  { id: 'budesonide', name: 'Budesonida', category: 'Respiratório', commonDosages: ['200mcg', '400mcg'], emoji: '🫁' },
  
  // Thyroid
  { id: 'levothyroxine', name: 'Levotiroxina', category: 'Hormonal', commonDosages: ['25mcg', '50mcg', '75mcg', '100mcg'], emoji: '🦋' },
  
  // Supplements
  { id: 'vitamin_d', name: 'Vitamina D', category: 'Suplemento', commonDosages: ['1000UI', '2000UI', '4000UI'], emoji: '☀️' },
  { id: 'vitamin_b12', name: 'Vitamina B12', category: 'Suplemento', commonDosages: ['250mcg', '500mcg', '1000mcg'], emoji: '🟢' },
  { id: 'iron', name: 'Ferro', category: 'Suplemento', commonDosages: ['14mg', '25mg', '40mg'], emoji: '🔴' },
];

const FREQUENCY_OPTIONS = [
  '1x ao dia',
  '2x ao dia', 
  '3x ao dia',
  'A cada 8 horas',
  'A cada 12 horas',
  'Quando necessário',
  'Semanal',
  'Conforme orientação médica'
];

export function MedicationSelector({ 
  onComplete, 
  isProcessing = false,
  initialValue = []
}: MedicationSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMedications, setSelectedMedications] = useState<SelectedMedication[]>(initialValue);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingMedication, setEditingMedication] = useState<SelectedMedication | null>(null);

  // Filter medications based on search term
  const filteredMedications = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase();
    return COMMON_MEDICATIONS.filter(med => 
      med.name.toLowerCase().includes(term) ||
      med.genericName?.toLowerCase().includes(term) ||
      med.category.toLowerCase().includes(term)
    ).slice(0, 8); // Limit to 8 suggestions
  }, [searchTerm]);

  // Group medications by category
  const groupedSuggestions = useMemo(() => {
    const groups = filteredMedications.reduce((acc, med) => {
      if (!acc[med.category]) acc[med.category] = [];
      acc[med.category].push(med);
      return acc;
    }, {} as Record<string, MedicationOption[]>);
    
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredMedications]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setShowSuggestions(value.length > 2);
  };

  const handleSelectMedication = (medication: MedicationOption) => {
    const selected: SelectedMedication = {
      id: medication.id,
      name: medication.name,
      category: medication.category,
      emoji: medication.emoji,
      dosage: medication.commonDosages[0], // Default to first dosage
      frequency: '1x ao dia' // Default frequency
    };
    
    // Check if already selected
    if (!selectedMedications.find(m => m.id === medication.id)) {
      setSelectedMedications(prev => [...prev, selected]);
    }
    
    setSearchTerm('');
    setShowSuggestions(false);
  };

  const handleEditMedication = (medication: SelectedMedication) => {
    setEditingMedication(medication);
  };

  const handleUpdateMedication = (updated: SelectedMedication) => {
    setSelectedMedications(prev => 
      prev.map(m => m.id === updated.id ? updated : m)
    );
    setEditingMedication(null);
  };

  const handleRemoveMedication = (medicationId: string) => {
    setSelectedMedications(prev => prev.filter(m => m.id !== medicationId));
  };

  const handleComplete = () => {
    onComplete(selectedMedications);
  };

  // Custom medication entry
  const handleAddCustomMedication = () => {
    if (searchTerm.trim()) {
      const customMed: SelectedMedication = {
        id: `custom_${Date.now()}`,
        name: searchTerm.trim(),
        category: 'Outros',
        emoji: '💊',
        frequency: '1x ao dia'
      };
      
      if (!selectedMedications.find(m => m.name.toLowerCase() === customMed.name.toLowerCase())) {
        setSelectedMedications(prev => [...prev, customMed]);
      }
      
      setSearchTerm('');
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Digite o nome do medicamento..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 pr-12 h-12 text-lg"
            onFocus={() => setShowSuggestions(searchTerm.length > 2)}
          />
          {searchTerm && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              onClick={() => {
                setSearchTerm('');
                setShowSuggestions(false);
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {showSuggestions && (filteredMedications.length > 0 || searchTerm.length > 2) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto"
            >
              {groupedSuggestions.map(([category, medications]) => (
                <div key={category} className="p-2">
                  <div className="text-xs font-medium text-gray-500 px-2 py-1 border-b border-gray-100">
                    {category}
                  </div>
                  {medications.map((medication) => (
                    <button
                      key={medication.id}
                      onClick={() => handleSelectMedication(medication)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-3"
                    >
                      <span className="text-lg">{medication.emoji}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{medication.name}</div>
                        <div className="text-sm text-gray-500">
                          Dosagens comuns: {medication.commonDosages.join(', ')}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
              
              {/* Custom medication option */}
              {searchTerm.length > 2 && !filteredMedications.find(m => 
                m.name.toLowerCase() === searchTerm.toLowerCase()
              ) && (
                <div className="border-t border-gray-100 p-2">
                  <button
                    onClick={handleAddCustomMedication}
                    className="w-full text-left px-3 py-2 hover:bg-green-50 rounded-md transition-colors flex items-center gap-3"
                  >
                    <Plus className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="font-medium text-green-700">
                        Adicionar "{searchTerm}"
                      </div>
                      <div className="text-sm text-green-600">
                        Medicamento não encontrado na lista
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selected Medications */}
      {selectedMedications.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Pill className="w-5 h-5 text-blue-600" />
            Medicamentos Selecionados ({selectedMedications.length})
          </h3>
          
          <div className="space-y-2">
            {selectedMedications.map((medication) => (
              <motion.div
                key={medication.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xl">{medication.emoji}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{medication.name}</div>
                        <div className="text-sm text-gray-600 flex items-center gap-4">
                          {medication.dosage && (
                            <span>Dosagem: {medication.dosage}</span>
                          )}
                          {medication.frequency && (
                            <span>Frequência: {medication.frequency}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditMedication(medication)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMedication(medication.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* No medications state */}
      {selectedMedications.length === 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Pill className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 mb-2">Nenhum medicamento adicionado</p>
          <p className="text-sm text-gray-500">
            Digite o nome de um medicamento para começar
          </p>
        </div>
      )}

      {/* Complete Button */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          {selectedMedications.length === 0 
            ? 'Você pode pular esta etapa se não toma medicamentos'
            : `${selectedMedications.length} medicamento${selectedMedications.length > 1 ? 's' : ''} selecionado${selectedMedications.length > 1 ? 's' : ''}`
          }
        </div>
        
        <Button
          onClick={handleComplete}
          disabled={isProcessing}
          className="min-w-[120px]"
        >
          {isProcessing ? 'Processando...' : 'Continuar'}
        </Button>
      </div>

      {/* Edit Medication Modal */}
      {editingMedication && (
        <MedicationEditModal
          medication={editingMedication}
          availableDosages={COMMON_MEDICATIONS.find(m => m.id === editingMedication.id)?.commonDosages || []}
          onSave={handleUpdateMedication}
          onCancel={() => setEditingMedication(null)}
        />
      )}
    </div>
  );
}

// Medication Edit Modal Component
interface MedicationEditModalProps {
  medication: SelectedMedication;
  availableDosages: string[];
  onSave: (medication: SelectedMedication) => void;
  onCancel: () => void;
}

function MedicationEditModal({ 
  medication, 
  availableDosages, 
  onSave, 
  onCancel 
}: MedicationEditModalProps) {
  const [dosage, setDosage] = useState(medication.dosage || '');
  const [frequency, setFrequency] = useState(medication.frequency || '1x ao dia');
  const [customDosage, setCustomDosage] = useState('');

  const handleSave = () => {
    onSave({
      ...medication,
      dosage: customDosage || dosage,
      frequency
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-lg p-6 w-full max-w-md"
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-xl">{medication.emoji}</span>
          Editar {medication.name}
        </h3>
        
        <div className="space-y-4">
          {/* Dosage Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dosagem
            </label>
            <div className="space-y-2">
              {availableDosages.map((dose) => (
                <label key={dose} className="flex items-center">
                  <input
                    type="radio"
                    name="dosage"
                    value={dose}
                    checked={dosage === dose}
                    onChange={(e) => {
                      setDosage(e.target.value);
                      setCustomDosage('');
                    }}
                    className="mr-2"
                  />
                  {dose}
                </label>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="dosage"
                  checked={!!customDosage}
                  onChange={() => setDosage('')}
                />
                <Input
                  placeholder="Dosagem personalizada"
                  value={customDosage}
                  onChange={(e) => {
                    setCustomDosage(e.target.value);
                    setDosage('');
                  }}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {/* Frequency Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Frequência
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {FREQUENCY_OPTIONS.map((freq) => (
                <option key={freq} value={freq}>{freq}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar
          </Button>
        </div>
      </motion.div>
    </div>
  );
}