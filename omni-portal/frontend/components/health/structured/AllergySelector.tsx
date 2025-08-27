'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Search, AlertCircle, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Allergy {
  id: string;
  name: string;
  category: string;
  severity?: 'mild' | 'moderate' | 'severe';
  emoji?: string;
  commonSymptoms?: string[];
}

interface AllergySelectorProps {
  onComplete: (allergies: Allergy[]) => void;
  isProcessing?: boolean;
  initialValue?: Allergy[];
}

// Common allergies database
const COMMON_ALLERGIES: Allergy[] = [
  // Food allergies
  { id: 'milk', name: 'Leite', category: 'Alimentos', emoji: '🥛', commonSymptoms: ['Inchaço', 'Diarreia', 'Cólicas'] },
  { id: 'eggs', name: 'Ovos', category: 'Alimentos', emoji: '🥚', commonSymptoms: ['Urticária', 'Congestão nasal', 'Vômitos'] },
  { id: 'peanuts', name: 'Amendoim', category: 'Alimentos', emoji: '🥜', commonSymptoms: ['Anafilaxia', 'Dificuldade respiratória'] },
  { id: 'tree_nuts', name: 'Nozes/Castanhas', category: 'Alimentos', emoji: '🌰', commonSymptoms: ['Inchaço', 'Coceira'] },
  { id: 'fish', name: 'Peixe', category: 'Alimentos', emoji: '🐟', commonSymptoms: ['Urticária', 'Náusea'] },
  { id: 'shellfish', name: 'Frutos do mar', category: 'Alimentos', emoji: '🦐', commonSymptoms: ['Inchaço', 'Dificuldade respiratória'] },
  { id: 'wheat', name: 'Trigo/Glúten', category: 'Alimentos', emoji: '🌾', commonSymptoms: ['Diarreia', 'Inchaço abdominal'] },
  { id: 'soy', name: 'Soja', category: 'Alimentos', emoji: '🌱', commonSymptoms: ['Urticária', 'Coceira'] },
  
  // Medication allergies
  { id: 'penicillin', name: 'Penicilina', category: 'Medicamentos', emoji: '💊', commonSymptoms: ['Erupção cutânea', 'Febre'] },
  { id: 'aspirin', name: 'Aspirina', category: 'Medicamentos', emoji: '💊', commonSymptoms: ['Asma', 'Urticária'] },
  { id: 'ibuprofen', name: 'Ibuprofeno', category: 'Medicamentos', emoji: '💊', commonSymptoms: ['Erupção cutânea', 'Inchaço'] },
  { id: 'sulfa', name: 'Sulfa', category: 'Medicamentos', emoji: '💊', commonSymptoms: ['Erupção cutânea', 'Febre'] },
  { id: 'codeine', name: 'Codeína', category: 'Medicamentos', emoji: '💊', commonSymptoms: ['Coceira', 'Náusea'] },
  
  // Environmental allergies
  { id: 'pollen', name: 'Pólen', category: 'Ambiental', emoji: '🌸', commonSymptoms: ['Espirros', 'Olhos lacrimejantes'] },
  { id: 'dust_mites', name: 'Ácaros', category: 'Ambiental', emoji: '🏠', commonSymptoms: ['Espirros', 'Congestão nasal'] },
  { id: 'mold', name: 'Mofo', category: 'Ambiental', emoji: '🦠', commonSymptoms: ['Tosse', 'Congestão'] },
  { id: 'pet_dander', name: 'Pelos de animais', category: 'Ambiental', emoji: '🐕', commonSymptoms: ['Espirros', 'Coceira nos olhos'] },
  { id: 'latex', name: 'Látex', category: 'Contato', emoji: '🧤', commonSymptoms: ['Vermelhidão', 'Coceira'] },
  { id: 'insect_stings', name: 'Picadas de insetos', category: 'Insetos', emoji: '🐝', commonSymptoms: ['Inchaço local', 'Dor'] },
];

export function AllergySelector({ 
  onComplete, 
  isProcessing = false,
  initialValue = []
}: AllergySelectorProps) {
  const [selectedAllergies, setSelectedAllergies] = useState<Allergy[]>(initialValue);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customAllergyName, setCustomAllergyName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Get unique categories
  const categories = Array.from(new Set(COMMON_ALLERGIES.map(a => a.category)));

  // Filter allergies based on search and category
  const filteredAllergies = COMMON_ALLERGIES.filter(allergy => {
    const matchesSearch = searchTerm ? 
      allergy.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
    const matchesCategory = selectedCategory ? 
      allergy.category === selectedCategory : true;
    const notSelected = !selectedAllergies.find(a => a.id === allergy.id);
    
    return matchesSearch && matchesCategory && notSelected;
  });

  const handleAddAllergy = (allergy: Allergy) => {
    setSelectedAllergies(prev => [...prev, allergy]);
    setSearchTerm('');
    setShowSuggestions(false);
  };

  const handleRemoveAllergy = (allergyId: string) => {
    setSelectedAllergies(prev => prev.filter(a => a.id !== allergyId));
  };

  const handleAddCustomAllergy = () => {
    if (customAllergyName.trim()) {
      const customAllergy: Allergy = {
        id: `custom_${Date.now()}`,
        name: customAllergyName.trim(),
        category: 'Outros',
        emoji: '⚠️'
      };
      
      if (!selectedAllergies.find(a => a.name.toLowerCase() === customAllergy.name.toLowerCase())) {
        setSelectedAllergies(prev => [...prev, customAllergy]);
      }
      
      setCustomAllergyName('');
      setShowCustomInput(false);
    }
  };

  const handleComplete = () => {
    onComplete(selectedAllergies);
  };

  return (
    <div className="space-y-6">
      {/* Search and Add Section */}
      <Card className="p-4">
        <div className="space-y-4">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              Todas
            </Button>
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar alergia..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(e.target.value.length > 0);
              }}
              className="pl-10 pr-12 h-12 text-lg"
              onFocus={() => setShowSuggestions(searchTerm.length > 0)}
            />
          </div>

          {/* Suggestions Dropdown */}
          <AnimatePresence>
            {showSuggestions && filteredAllergies.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="border rounded-lg p-2 max-h-60 overflow-y-auto bg-white shadow-lg"
              >
                {filteredAllergies.slice(0, 10).map(allergy => (
                  <button
                    key={allergy.id}
                    onClick={() => handleAddAllergy(allergy)}
                    className="w-full text-left p-3 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{allergy.emoji}</span>
                      <div>
                        <div className="font-medium">{allergy.name}</div>
                        <div className="text-sm text-gray-500">{allergy.category}</div>
                      </div>
                    </div>
                    <Plus className="w-5 h-5 text-gray-400" />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Custom Allergy Input */}
          <div className="flex gap-2">
            {!showCustomInput ? (
              <Button
                onClick={() => setShowCustomInput(true)}
                variant="outline"
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar alergia não listada
              </Button>
            ) : (
              <div className="flex gap-2 w-full">
                <Input
                  placeholder="Nome da alergia..."
                  value={customAllergyName}
                  onChange={(e) => setCustomAllergyName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCustomAllergy()}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  onClick={handleAddCustomAllergy}
                  disabled={!customAllergyName.trim()}
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomAllergyName('');
                  }}
                  variant="outline"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Selected Allergies */}
      {selectedAllergies.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            Alergias Selecionadas ({selectedAllergies.length})
          </h3>
          <div className="space-y-2">
            {selectedAllergies.map(allergy => (
              <motion.div
                key={allergy.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{allergy.emoji}</span>
                  <div>
                    <div className="font-medium">{allergy.name}</div>
                    <div className="text-sm text-gray-600">{allergy.category}</div>
                    {allergy.commonSymptoms && (
                      <div className="text-xs text-gray-500 mt-1">
                        Sintomas: {allergy.commonSymptoms.slice(0, 2).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => handleRemoveAllergy(allergy.id)}
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Informe todas as suas alergias conhecidas, incluindo alimentos, medicamentos e substâncias ambientais. 
          Esta informação é crucial para sua segurança médica.
        </AlertDescription>
      </Alert>

      {/* Continue Button */}
      <Button
        onClick={handleComplete}
        disabled={isProcessing}
        className="w-full h-12 text-lg"
        size="lg"
      >
        {isProcessing ? 'Processando...' : 'Continuar'}
      </Button>
    </div>
  );
}