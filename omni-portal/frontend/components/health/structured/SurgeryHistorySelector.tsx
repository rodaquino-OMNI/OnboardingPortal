'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus,
  Trash2,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Scissors,
  Heart,
  Brain,
  Bone,
  Activity,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Surgery {
  id: string;
  type: string;
  year: string;
  location?: string;
  complications?: boolean;
  notes?: string;
}

interface SurgeryHistorySelectorProps {
  onComplete: (surgeries: Surgery[]) => void;
  isProcessing?: boolean;
  initialValue?: Surgery[];
  title?: string;
  description?: string;
}

// Common surgery types with icons and categories
const SURGERY_TYPES = [
  { value: 'appendix', label: 'Apendicectomia', category: 'Abdominal', icon: Activity },
  { value: 'gallbladder', label: 'Vesícula biliar', category: 'Abdominal', icon: Activity },
  { value: 'hernia', label: 'Hérnia', category: 'Abdominal', icon: Activity },
  { value: 'cardiac', label: 'Cirurgia cardíaca', category: 'Cardiovascular', icon: Heart },
  { value: 'bypass', label: 'Ponte de safena', category: 'Cardiovascular', icon: Heart },
  { value: 'cataract', label: 'Catarata', category: 'Oftalmológica', icon: Brain },
  { value: 'knee', label: 'Joelho', category: 'Ortopédica', icon: Bone },
  { value: 'hip', label: 'Quadril', category: 'Ortopédica', icon: Bone },
  { value: 'spine', label: 'Coluna vertebral', category: 'Ortopédica', icon: Bone },
  { value: 'cesarean', label: 'Cesárea', category: 'Ginecológica', icon: Shield },
  { value: 'hysterectomy', label: 'Histerectomia', category: 'Ginecológica', icon: Shield },
  { value: 'tonsils', label: 'Amídalas', category: 'Otorrinolaringológica', icon: Brain },
  { value: 'other', label: 'Outra cirurgia', category: 'Outras', icon: Scissors }
];

const SURGERY_YEARS = [
  { value: 'current_year', label: '2024 (Ano atual)' },
  { value: '2023', label: '2023' },
  { value: '2022', label: '2022' },
  { value: '2021', label: '2021' },
  { value: '2020', label: '2020' },
  { value: '2015-2019', label: '2015-2019' },
  { value: '2010-2014', label: '2010-2014' },
  { value: '2005-2009', label: '2005-2009' },
  { value: '2000-2004', label: '2000-2004' },
  { value: 'before_2000', label: 'Antes de 2000' },
  { value: 'childhood', label: 'Na infância/adolescência' }
];

export function SurgeryHistorySelector({
  onComplete,
  isProcessing = false,
  initialValue = [],
  title = "Histórico de Cirurgias",
  description = "Selecione as cirurgias que você já fez e forneça detalhes estruturados"
}: SurgeryHistorySelectorProps) {
  const [surgeries, setSurgeries] = useState<Surgery[]>(initialValue);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newSurgery, setNewSurgery] = useState<Partial<Surgery>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const generateId = () => `surgery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addSurgery = useCallback(() => {
    if (!newSurgery.type || !newSurgery.year) {
      setErrors({
        type: !newSurgery.type ? 'Tipo de cirurgia é obrigatório' : '',
        year: !newSurgery.year ? 'Ano da cirurgia é obrigatório' : ''
      });
      return;
    }

    const surgery: Surgery = {
      id: generateId(),
      type: newSurgery.type!,
      year: newSurgery.year!,
      location: newSurgery.location || '',
      complications: newSurgery.complications || false,
      notes: newSurgery.notes || ''
    };

    setSurgeries(prev => [...prev, surgery]);
    setNewSurgery({});
    setIsAddingNew(false);
    setErrors({});
  }, [newSurgery]);

  const removeSurgery = useCallback((id: string) => {
    setSurgeries(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleComplete = useCallback(() => {
    onComplete(surgeries);
  }, [surgeries, onComplete]);

  const getSurgeryTypeInfo = (type: string) => {
    return SURGERY_TYPES.find(t => t.value === type);
  };

  const getYearLabel = (year: string) => {
    return SURGERY_YEARS.find(y => y.value === year)?.label || year;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Scissors className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
      </div>

      {/* Existing Surgeries */}
      {surgeries.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Cirurgias registradas ({surgeries.length})</h4>
          {surgeries.map((surgery) => {
            const typeInfo = getSurgeryTypeInfo(surgery.type);
            const IconComponent = typeInfo?.icon || Scissors;
            
            return (
              <motion.div
                key={surgery.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <IconComponent className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">{typeInfo?.label || surgery.type}</h5>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {getYearLabel(surgery.year)}
                        </div>
                        {surgery.location && (
                          <div>📍 {surgery.location}</div>
                        )}
                      </div>
                      {surgery.complications && (
                        <Badge variant="outline" className="mt-2 text-orange-700 border-orange-200">
                          Com complicações
                        </Badge>
                      )}
                      {surgery.notes && (
                        <p className="text-sm text-gray-600 mt-2">{surgery.notes}</p>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSurgery(surgery.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add New Surgery Form */}
      <AnimatePresence>
        {isAddingNew && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Card className="p-6 border-blue-200 bg-blue-50">
              <h4 className="font-medium text-gray-900 mb-4">Adicionar nova cirurgia</h4>
              
              <div className="space-y-4">
                {/* Surgery Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de cirurgia *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SURGERY_TYPES.map((type) => {
                      const IconComponent = type.icon;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => {
                            setNewSurgery(prev => ({ ...prev, type: type.value }));
                            setErrors(prev => ({ ...prev, type: '' }));
                          }}
                          className={`p-3 text-left border rounded-lg transition-all ${
                            newSurgery.type === type.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <IconComponent className="w-4 h-4" />
                            <div>
                              <div className="font-medium text-sm">{type.label}</div>
                              <div className="text-xs text-gray-600">{type.category}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {errors.type && (
                    <div className="flex items-center gap-1 mt-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      {errors.type}
                    </div>
                  )}
                </div>

                {/* Year Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quando foi realizada? *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SURGERY_YEARS.map((year) => (
                      <button
                        key={year.value}
                        type="button"
                        onClick={() => {
                          setNewSurgery(prev => ({ ...prev, year: year.value }));
                          setErrors(prev => ({ ...prev, year: '' }));
                        }}
                        className={`p-3 text-left border rounded-lg transition-all ${
                          newSurgery.year === year.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="font-medium text-sm">{year.label}</div>
                      </button>
                    ))}
                  </div>
                  {errors.year && (
                    <div className="flex items-center gap-1 mt-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      {errors.year}
                    </div>
                  )}
                </div>

                {/* Optional: Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Local/Hospital (opcional)
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Hospital São Paulo"
                    value={newSurgery.location || ''}
                    onChange={(e) => setNewSurgery(prev => ({ ...prev, location: e.target.value }))}
                  />
                </div>

                {/* Complications */}
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newSurgery.complications || false}
                      onChange={(e) => setNewSurgery(prev => ({ ...prev, complications: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Houve complicações durante ou após a cirurgia
                    </span>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsAddingNew(false);
                      setNewSurgery({});
                      setErrors({});
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={addSurgery}>
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Cirurgia
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add New Surgery Button */}
      {!isAddingNew && (
        <Button
          variant="outline"
          onClick={() => setIsAddingNew(true)}
          className="w-full border-dashed border-2 py-8 text-gray-600 hover:text-gray-900 hover:border-gray-400"
        >
          <Plus className="w-5 h-5 mr-2" />
          Adicionar cirurgia realizada
        </Button>
      )}

      {/* No Surgeries Option */}
      <Card 
        className={`p-4 cursor-pointer transition-all ${
          surgeries.length === 0 && !isAddingNew
            ? 'border-green-500 bg-green-50'
            : 'hover:bg-gray-50'
        }`}
        onClick={() => {
          if (surgeries.length > 0) {
            setSurgeries([]);
          }
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">Nunca fiz cirurgias</h4>
            <p className="text-sm text-gray-600">Não tenho histórico de procedimentos cirúrgicos</p>
          </div>
        </div>
      </Card>

      {/* Summary */}
      {surgeries.length > 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 mb-2">
                {surgeries.length} cirurgia{surgeries.length > 1 ? 's' : ''} registrada{surgeries.length > 1 ? 's' : ''}
              </h4>
              <div className="space-y-1 text-sm text-blue-800">
                {surgeries.map(surgery => {
                  const typeInfo = getSurgeryTypeInfo(surgery.type);
                  return (
                    <div key={surgery.id} className="flex justify-between items-center">
                      <span>{typeInfo?.label || surgery.type}</span>
                      <Badge variant="outline" className="text-xs bg-white/80">
                        {getYearLabel(surgery.year)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          {surgeries.length === 0 
            ? 'Registre suas cirurgias ou marque "Nunca fiz cirurgias"'
            : `${surgeries.length} cirurgia${surgeries.length > 1 ? 's' : ''} registrada${surgeries.length > 1 ? 's' : ''}`
          }
        </div>
        
        <Button
          onClick={handleComplete}
          disabled={isProcessing}
          className="min-w-[120px]"
        >
          {isProcessing ? 'Salvando...' : 'Continuar'}
        </Button>
      </div>
    </div>
  );
}